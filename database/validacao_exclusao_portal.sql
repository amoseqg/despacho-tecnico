-- Decisão do operador, autorização de encerramento e exclusão auditável no portal.

alter table public.validacoes_encerramento
  add column if not exists resultado text,
  add column if not exists motivo_nao_validacao text;

update public.validacoes_encerramento
set resultado = 'validado'
where resultado is null;

alter table public.validacoes_encerramento
  alter column resultado set default 'validado',
  alter column resultado set not null,
  alter column senha drop not null;

alter table public.validacoes_encerramento
  drop constraint if exists validacoes_encerramento_resultado_check,
  drop constraint if exists validacoes_encerramento_decisao_check;

alter table public.validacoes_encerramento
  add constraint validacoes_encerramento_resultado_check
    check (resultado in ('validado','nao_validado')),
  add constraint validacoes_encerramento_decisao_check
    check (
      (resultado = 'validado' and length(trim(coalesce(senha,''))) between 1 and 160 and motivo_nao_validacao is null)
      or
      (resultado = 'nao_validado' and senha is null and length(trim(coalesce(motivo_nao_validacao,''))) between 3 and 1000)
    );

create index if not exists idx_validacoes_encerramento_resultado_validado_em
  on public.validacoes_encerramento (resultado, validado_em desc);

create table if not exists public.exclusoes_chamados_portal (
  chamado_id uuid primary key references public.chamados(id) on delete cascade,
  solicitante_id uuid not null references auth.users(id) on delete cascade,
  excluido_por_nome text not null check (length(trim(excluido_por_nome)) between 2 and 200),
  excluido_por_email text not null check (length(trim(excluido_por_email)) between 3 and 320),
  status_anterior text not null,
  excluido_em timestamptz not null default now()
);

create index if not exists idx_exclusoes_chamados_portal_solicitante_data
  on public.exclusoes_chamados_portal (solicitante_id, excluido_em desc);

alter table public.exclusoes_chamados_portal enable row level security;
grant select on public.exclusoes_chamados_portal to authenticated;

drop policy if exists exclusoes_portal_select on public.exclusoes_chamados_portal;
create policy exclusoes_portal_select
  on public.exclusoes_chamados_portal for select to authenticated
  using (
    solicitante_id = (select auth.uid())
    or (select public.usuario_e_admin())
    or exists (
      select 1 from public.chamados c
      where c.id = chamado_id and c.tecnico_id = (select auth.uid())
    )
  );

create or replace function public.excluir_chamado_portal(p_chamado_id uuid)
returns public.exclusoes_chamados_portal
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chamado public.chamados;
  v_solicitante public.solicitantes_chamados;
  v_exclusao public.exclusoes_chamados_portal;
begin
  select * into v_chamado
  from public.chamados
  where id = p_chamado_id and solicitante_id = (select auth.uid())
  for update;

  if v_chamado.id is null then
    raise exception 'Chamado não encontrado ou não pertence ao solicitante.';
  end if;
  if v_chamado.status = 'concluida' then
    raise exception 'Chamado concluído não pode ser excluído pelo portal.';
  end if;

  select * into v_solicitante
  from public.solicitantes_chamados
  where user_id = (select auth.uid()) and ativo = true;

  if v_solicitante.user_id is null then
    raise exception 'Solicitante não autorizado.';
  end if;

  insert into public.exclusoes_chamados_portal
    (chamado_id, solicitante_id, excluido_por_nome, excluido_por_email, status_anterior)
  values
    (v_chamado.id, v_solicitante.user_id, v_solicitante.nome, v_solicitante.email, v_chamado.status::text)
  on conflict (chamado_id) do update set
    solicitante_id = excluded.solicitante_id,
    excluido_por_nome = excluded.excluido_por_nome,
    excluido_por_email = excluded.excluido_por_email,
    status_anterior = excluded.status_anterior,
    excluido_em = now()
  returning * into v_exclusao;

  update public.chamados
  set status = 'cancelado', atualizado_em = now()
  where id = v_chamado.id;

  return v_exclusao;
end;
$$;

revoke all on function public.excluir_chamado_portal(uuid) from public;
revoke all on function public.excluir_chamado_portal(uuid) from anon;
grant execute on function public.excluir_chamado_portal(uuid) to authenticated;

create or replace function public.exigir_validacao_operador_antes_conclusao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'concluida'
     and old.status is distinct from 'concluida'
     and new.solicitante_id is not null then
    if new.tecnico_id is null or new.tecnico_id <> (select auth.uid()) then
      raise exception 'Somente o técnico responsável pode encerrar este chamado.';
    end if;
    if not exists (
      select 1 from public.validacoes_encerramento v
      where v.chamado_id = new.id
        and v.solicitante_id = new.solicitante_id
        and v.resultado = 'validado'
        and length(trim(coalesce(v.senha,''))) > 0
    ) then
      raise exception 'O encerramento ainda não foi autorizado pelo operador.';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'exclusoes_chamados_portal'
  ) then
    alter publication supabase_realtime add table public.exclusoes_chamados_portal;
  end if;
end $$;

comment on column public.validacoes_encerramento.resultado is
  'Decisão do operador: validado autoriza o técnico; nao_validado exige correção.';
comment on column public.validacoes_encerramento.motivo_nao_validacao is
  'Motivo obrigatório quando o operador não valida o encerramento.';
comment on table public.exclusoes_chamados_portal is
  'Auditoria de chamados excluídos pelo solicitante no portal externo.';
