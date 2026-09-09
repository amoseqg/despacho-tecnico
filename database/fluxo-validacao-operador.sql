-- Fluxo: técnico envia encerramento, operador valida, técnico encerra e administrador aprova.

alter table public.execucoes
  add column if not exists enviado_validacao_em timestamptz;

alter table public.solicitantes_chamados
  add column if not exists operadora text
    check (operadora in ('vectra','um_telecom','metodo'));

update public.solicitantes_chamados set operadora = 'metodo' where operadora is null;
alter table public.solicitantes_chamados alter column operadora set not null;

alter table public.chamados
  add column if not exists operadora text
    check (operadora in ('vectra','um_telecom','metodo'));

create index if not exists idx_chamados_operadora_criado_em
  on public.chamados (operadora, criado_em desc)
  where operadora is not null;

create or replace function public.atribuir_operadora_chamado_portal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.solicitante_id is not null then
    select s.operadora into new.operadora
    from public.solicitantes_chamados s
    where s.user_id = new.solicitante_id and s.ativo = true;
    if new.operadora is null then
      raise exception 'Operadora do solicitante não cadastrada.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vincular_operadora_portal on public.chamados;
create trigger trg_vincular_operadora_portal
before insert on public.chamados
for each row execute function public.atribuir_operadora_chamado_portal();

create table if not exists public.validacoes_encerramento (
  chamado_id uuid primary key references public.chamados(id) on delete cascade,
  solicitante_id uuid not null references auth.users(id) on delete cascade,
  validacao text not null check (length(trim(validacao)) between 2 and 300),
  senha text not null check (length(trim(senha)) between 1 and 160),
  validado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_validacoes_encerramento_solicitante
  on public.validacoes_encerramento (solicitante_id);

alter table public.validacoes_encerramento enable row level security;
grant select, insert, update on public.validacoes_encerramento to authenticated;

drop policy if exists validacoes_encerramento_select on public.validacoes_encerramento;
create policy validacoes_encerramento_select
  on public.validacoes_encerramento for select to authenticated
  using (
    (select public.usuario_e_admin())
    or solicitante_id = (select auth.uid())
    or exists (
      select 1 from public.chamados c
      where c.id = chamado_id and c.tecnico_id = (select auth.uid())
    )
  );

drop policy if exists validacoes_encerramento_insert on public.validacoes_encerramento;
create policy validacoes_encerramento_insert
  on public.validacoes_encerramento for insert to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and exists (
      select 1 from public.chamados c
      join public.execucoes e on e.chamado_id = c.id
      where c.id = chamado_id
        and c.solicitante_id = (select auth.uid())
        and c.status = 'andamento'
        and e.enviado_validacao_em is not null
    )
  );

drop policy if exists validacoes_encerramento_update on public.validacoes_encerramento;
create policy validacoes_encerramento_update
  on public.validacoes_encerramento for update to authenticated
  using (solicitante_id = (select auth.uid()))
  with check (solicitante_id = (select auth.uid()));

drop policy if exists execucoes_solicitante_select on public.execucoes;
create policy execucoes_solicitante_select
  on public.execucoes for select to authenticated
  using (
    enviado_validacao_em is not null
    and exists (
      select 1 from public.chamados c
      where c.id = chamado_id and c.solicitante_id = (select auth.uid())
    )
  );

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
      where v.chamado_id = new.id and v.solicitante_id = new.solicitante_id
    ) then
      raise exception 'Aguarde a senha e a validação do operador antes de encerrar.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exigir_validacao_operador on public.chamados;
create trigger trg_exigir_validacao_operador
before update of status on public.chamados
for each row execute function public.exigir_validacao_operador_antes_conclusao();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'validacoes_encerramento'
  ) then
    alter publication supabase_realtime add table public.validacoes_encerramento;
  end if;
end $$;

comment on table public.validacoes_encerramento is
  'Senha e confirmação informadas pelo operador após receber a máscara do técnico.';
comment on column public.execucoes.enviado_validacao_em is
  'Momento em que o técnico disponibilizou o encerramento ao operador.';
