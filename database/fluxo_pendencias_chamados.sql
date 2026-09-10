-- Solicitação, autorização e saída automática de pendências operacionais.

alter table public.chamados
  add column if not exists pendencia_ativa boolean not null default false,
  add column if not exists pendencia_desde timestamptz,
  add column if not exists prazo_pausado_segundos bigint not null default 0
    check (prazo_pausado_segundos >= 0);

create table if not exists public.solicitacoes_pendencia (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  solicitante_id uuid references auth.users(id) on delete cascade,
  tecnico_id uuid references public.perfis(id) on delete set null,
  origem text not null check (origem in ('operador','tecnico')),
  solicitado_por_nome text not null check (length(trim(solicitado_por_nome)) between 2 and 200),
  solicitado_por_email text,
  motivo text not null check (motivo in ('pedido_cliente','local_fechado','feriado','fortes_chuvas','falta_energia','horario_expediente')),
  mensagem text not null check (length(trim(mensagem)) between 3 and 2000),
  aprazado_para timestamptz not null,
  saida_programada_em timestamptz not null,
  status text not null default 'solicitada' check (status in ('solicitada','aprovada','rejeitada','encerrada')),
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_por_nome text,
  decisao_mensagem text,
  solicitado_em timestamptz not null default now(),
  decidido_em timestamptz,
  encerrado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  check (saida_programada_em <= aprazado_para),
  check (
    (origem = 'operador' and solicitante_id is not null)
    or (origem = 'tecnico' and tecnico_id is not null)
  )
);

create index if not exists idx_pendencias_chamado_data
  on public.solicitacoes_pendencia (chamado_id, solicitado_em desc);
create index if not exists idx_pendencias_status_saida
  on public.solicitacoes_pendencia (status, saida_programada_em)
  where status in ('solicitada','aprovada');
create index if not exists idx_pendencias_solicitante
  on public.solicitacoes_pendencia (solicitante_id) where solicitante_id is not null;
create index if not exists idx_pendencias_tecnico
  on public.solicitacoes_pendencia (tecnico_id) where tecnico_id is not null;
create index if not exists idx_pendencias_decisor
  on public.solicitacoes_pendencia (decidido_por) where decidido_por is not null;
create unique index if not exists idx_pendencia_ativa_por_chamado
  on public.solicitacoes_pendencia (chamado_id)
  where status in ('solicitada','aprovada');

alter table public.solicitacoes_pendencia enable row level security;
grant select, insert on public.solicitacoes_pendencia to authenticated;

drop policy if exists pendencias_select on public.solicitacoes_pendencia;
create policy pendencias_select
  on public.solicitacoes_pendencia for select to authenticated
  using (
    (select public.usuario_e_admin())
    or solicitante_id = (select auth.uid())
    or exists (
      select 1 from public.chamados c
      where c.id = chamado_id and c.tecnico_id = (select auth.uid())
    )
  );

drop policy if exists pendencias_insert on public.solicitacoes_pendencia;
create policy pendencias_insert
  on public.solicitacoes_pendencia for insert to authenticated
  with check (
    status = 'solicitada'
    and decidido_por is null
    and decidido_em is null
    and aprazado_para > now()
    and saida_programada_em > now()
    and (
      (
        origem = 'operador'
        and solicitante_id = (select auth.uid())
        and tecnico_id is null
        and exists (
          select 1 from public.chamados c
          where c.id = chamado_id
            and c.solicitante_id = (select auth.uid())
            and c.status in ('aberto','pendente','andamento')
            and not c.pendencia_ativa
        )
      )
      or
      (
        origem = 'tecnico'
        and tecnico_id = (select auth.uid())
        and solicitante_id is null
        and exists (
          select 1 from public.chamados c
          where c.id = chamado_id
            and c.tecnico_id = (select auth.uid())
            and c.status = 'andamento'
            and not c.pendencia_ativa
        )
      )
    )
  );

create or replace function public.decidir_pendencia_operador(
  p_pendencia_id uuid,
  p_decisao text,
  p_mensagem text default null
)
returns public.solicitacoes_pendencia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pendencia public.solicitacoes_pendencia;
  v_solicitante public.solicitantes_chamados;
begin
  if p_decisao not in ('aprovada','rejeitada') then
    raise exception 'Decisão inválida.';
  end if;

  select p.* into v_pendencia
  from public.solicitacoes_pendencia p
  join public.chamados c on c.id = p.chamado_id
  where p.id = p_pendencia_id
    and p.status = 'solicitada'
    and c.solicitante_id = (select auth.uid())
  for update of p;

  if v_pendencia.id is null then
    raise exception 'Solicitação não encontrada ou sem permissão para decidir.';
  end if;

  select * into v_solicitante
  from public.solicitantes_chamados
  where user_id = (select auth.uid()) and ativo = true;

  if v_solicitante.user_id is null then
    raise exception 'Operador não autorizado.';
  end if;

  update public.solicitacoes_pendencia
  set status = p_decisao,
      decidido_por = v_solicitante.user_id,
      decidido_por_nome = v_solicitante.nome,
      decisao_mensagem = nullif(trim(p_mensagem),''),
      decidido_em = now(),
      atualizado_em = now()
  where id = v_pendencia.id
  returning * into v_pendencia;

  if p_decisao = 'aprovada' then
    update public.chamados
    set pendencia_ativa = true,
        pendencia_desde = now(),
        vencimento_em = v_pendencia.aprazado_para,
        atualizado_em = now()
    where id = v_pendencia.chamado_id;
  end if;

  return v_pendencia;
end;
$$;

revoke all on function public.decidir_pendencia_operador(uuid,text,text) from public;
revoke all on function public.decidir_pendencia_operador(uuid,text,text) from anon;
grant execute on function public.decidir_pendencia_operador(uuid,text,text) to authenticated;

create or replace function public.finalizar_pendencias_programadas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  with finalizadas as (
    update public.solicitacoes_pendencia
    set status = 'encerrada', encerrado_em = now(), atualizado_em = now()
    where status = 'aprovada' and saida_programada_em <= now()
    returning chamado_id, saida_programada_em, decidido_em
  ), atualizadas as (
    update public.chamados c
    set pendencia_ativa = false,
        prazo_pausado_segundos = c.prazo_pausado_segundos + greatest(0, extract(epoch from (f.saida_programada_em - f.decidido_em)))::bigint,
        pendencia_desde = null,
        atualizado_em = now()
    from finalizadas f
    where c.id = f.chamado_id
    returning c.id
  )
  select count(*) into v_total from atualizadas;
  return v_total;
end;
$$;

revoke all on function public.finalizar_pendencias_programadas() from public;
revoke all on function public.finalizar_pendencias_programadas() from anon;
revoke all on function public.finalizar_pendencias_programadas() from authenticated;

create extension if not exists pg_cron with schema extensions;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'nexofield-finalizar-pendencias') then
    perform cron.schedule(
      'nexofield-finalizar-pendencias',
      '* * * * *',
      'select public.finalizar_pendencias_programadas()'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitacoes_pendencia'
  ) then
    alter publication supabase_realtime add table public.solicitacoes_pendencia;
  end if;
end $$;

create or replace function public.aplicar_sla_portal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.solicitante_id is not null then
    new.vencimento_em := now() + case when new.regiao = 'interior' then interval '8 hours' else interval '6 hours' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sla_portal on public.chamados;
create trigger trg_sla_portal
before insert on public.chamados
for each row execute function public.aplicar_sla_portal();

comment on table public.solicitacoes_pendencia is
  'Solicitações de pendência criadas por técnico ou operador e decididas exclusivamente pelo operador.';
