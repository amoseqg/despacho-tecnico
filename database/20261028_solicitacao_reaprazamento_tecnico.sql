create table public.solicitacoes_reaprazamento_admin (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  tecnico_id uuid not null references public.perfis(id),
  tecnico_nome text not null,
  motivo text not null check (length(trim(motivo)) between 3 and 1000),
  status text not null default 'solicitada'
    check (status in ('solicitada', 'aprovada', 'rejeitada')),
  vencimento_anterior timestamptz,
  novo_vencimento timestamptz,
  decidido_por uuid references public.perfis(id),
  decidido_por_nome text,
  resposta_admin text,
  solicitado_em timestamptz not null default now(),
  decidido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  check (
    (status = 'solicitada' and decidido_por is null and decidido_em is null and novo_vencimento is null)
    or
    (status = 'aprovada' and decidido_por is not null and decidido_em is not null and novo_vencimento is not null)
    or
    (status = 'rejeitada' and decidido_por is not null and decidido_em is not null and novo_vencimento is null)
  )
);

create unique index solicitacoes_reaprazamento_uma_pendente_por_chamado
  on public.solicitacoes_reaprazamento_admin(chamado_id)
  where status = 'solicitada';

alter table public.solicitacoes_reaprazamento_admin enable row level security;
grant select, insert, update on public.solicitacoes_reaprazamento_admin to authenticated;
revoke all on public.solicitacoes_reaprazamento_admin from anon;

create policy solicitacoes_reaprazamento_select
  on public.solicitacoes_reaprazamento_admin
  for select to authenticated
  using (public.usuario_e_admin() or tecnico_id = (select auth.uid()));

create policy solicitacoes_reaprazamento_insert
  on public.solicitacoes_reaprazamento_admin
  for insert to authenticated
  with check (
    tecnico_id = (select auth.uid())
    and status = 'solicitada'
    and decidido_por is null
    and decidido_em is null
    and novo_vencimento is null
    and exists (
      select 1 from public.perfis perfil
      where perfil.id = (select auth.uid())
        and perfil.tipo = 'tecnico'
        and perfil.ativo = true
    )
    and exists (
      select 1 from public.chamados chamado
      where chamado.id = chamado_id
        and chamado.tecnico_id = (select auth.uid())
        and chamado.status = 'andamento'
    )
  );

create policy solicitacoes_reaprazamento_update_admin
  on public.solicitacoes_reaprazamento_admin
  for update to authenticated
  using (public.usuario_e_admin())
  with check (public.usuario_e_admin());

create or replace function public.solicitar_reaprazamento_admin(
  p_chamado_id uuid,
  p_motivo text
)
returns public.solicitacoes_reaprazamento_admin
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  t public.perfis;
  c public.chamados;
  r public.solicitacoes_reaprazamento_admin;
begin
  select * into t
  from public.perfis
  where id = auth.uid() and tipo = 'tecnico' and ativo = true;

  if t.id is null then
    raise exception 'Somente técnico ativo pode solicitar reaprazamento.'
      using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da solicitação.';
  end if;

  select * into c
  from public.chamados
  where id = p_chamado_id
    and tecnico_id = auth.uid()
  for update;

  if c.id is null or c.status <> 'andamento' then
    raise exception 'O chamado não está em atendimento com este técnico.';
  end if;

  if exists (
    select 1
    from public.solicitacoes_reaprazamento_admin
    where chamado_id = c.id and status = 'solicitada'
  ) then
    raise exception 'Já existe uma solicitação de reaprazamento aguardando o administrador.';
  end if;

  insert into public.solicitacoes_reaprazamento_admin(
    chamado_id, tecnico_id, tecnico_nome, motivo, vencimento_anterior
  )
  values (c.id, t.id, t.nome, trim(p_motivo), c.vencimento_em)
  returning * into r;

  return r;
exception
  when unique_violation then
    raise exception 'Já existe uma solicitação de reaprazamento aguardando o administrador.';
end
$function$;

create or replace function public.decidir_reaprazamento_admin(
  p_solicitacao_id uuid,
  p_decisao text,
  p_novo_vencimento timestamptz,
  p_resposta text
)
returns public.solicitacoes_reaprazamento_admin
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  a public.perfis;
  c public.chamados;
  r public.solicitacoes_reaprazamento_admin;
  pe public.pendencias_expediente_admin;
  vencimento_base timestamptz;
  prazo_segundos bigint;
begin
  select * into a
  from public.perfis
  where id = auth.uid() and tipo = 'admin' and ativo = true;

  if a.id is null then
    raise exception 'Somente administrador ativo pode decidir a solicitação.'
      using errcode = '42501';
  end if;

  if p_decisao is null or p_decisao not in ('aprovada', 'rejeitada')
     or length(trim(coalesce(p_resposta, ''))) < 3 then
    raise exception 'Informe a decisão e a resposta ao técnico.';
  end if;

  select c1.* into c
  from public.chamados c1
  join public.solicitacoes_reaprazamento_admin s on s.chamado_id = c1.id
  where s.id = p_solicitacao_id
  for update of c1;

  select * into r
  from public.solicitacoes_reaprazamento_admin
  where id = p_solicitacao_id
  for update;

  if r.id is null or r.status <> 'solicitada' or c.id is null
     or c.status not in ('aberto', 'pendente', 'andamento') then
    raise exception 'A solicitação não está mais pendente ou o chamado não está ativo.';
  end if;

  if p_decisao = 'aprovada' then
    if p_novo_vencimento is null
       or p_novo_vencimento <= greatest(now(), coalesce(c.vencimento_em, now())) then
      raise exception 'O novo vencimento deve ser posterior ao prazo atual e ao momento da aprovação.';
    end if;

    select * into pe
    from public.pendencias_expediente_admin
    where chamado_id = c.id and status = 'pausado'
    order by criado_em desc
    limit 1
    for update;

    if pe.id is not null then
      vencimento_base := greatest(now(), pe.retorno_em);
      if p_novo_vencimento <= vencimento_base then
        raise exception 'O novo vencimento deve ser posterior ao retorno programado.';
      end if;
      prazo_segundos := floor(extract(epoch from p_novo_vencimento - vencimento_base))::bigint;
      if prazo_segundos <= 0 then
        raise exception 'Informe um prazo adicional maior que zero.';
      end if;

      update public.pendencias_expediente_admin
      set retorno_em = vencimento_base,
          vencimento_reprogramado = p_novo_vencimento,
          prazo_restante_segundos = prazo_segundos
      where id = pe.id;
    end if;

    update public.chamados
    set vencimento_em = p_novo_vencimento,
        atualizado_em = now()
    where id = c.id;
  elsif p_novo_vencimento is not null then
    raise exception 'A recusa da solicitação não deve alterar o vencimento.';
  end if;

  update public.solicitacoes_reaprazamento_admin
  set status = p_decisao,
      novo_vencimento = case when p_decisao = 'aprovada' then p_novo_vencimento else null end,
      decidido_por = a.id,
      decidido_por_nome = a.nome,
      resposta_admin = trim(p_resposta),
      decidido_em = now(),
      atualizado_em = now()
  where id = r.id
  returning * into r;

  return r;
end
$function$;

revoke all on function public.solicitar_reaprazamento_admin(uuid, text) from public, anon;
grant execute on function public.solicitar_reaprazamento_admin(uuid, text) to authenticated;
revoke all on function public.decidir_reaprazamento_admin(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.decidir_reaprazamento_admin(uuid, text, timestamptz, text) to authenticated;