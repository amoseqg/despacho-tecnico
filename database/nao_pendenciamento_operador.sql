-- Registro explícito do motivo pelo qual o operador decidiu não pendenciar um chamado.
create table if not exists public.nao_pendenciamentos_chamados (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  operador_id uuid not null references auth.users(id) on delete cascade,
  operador_nome text not null check (length(trim(operador_nome)) between 2 and 200),
  motivo text not null check (length(trim(motivo)) between 3 and 2000),
  criado_em timestamptz not null default now()
);
create index if not exists idx_nao_pendenciamento_chamado_data on public.nao_pendenciamentos_chamados (chamado_id, criado_em desc);
create index if not exists idx_nao_pendenciamento_operador on public.nao_pendenciamentos_chamados (operador_id);
alter table public.nao_pendenciamentos_chamados enable row level security;
grant select, insert on public.nao_pendenciamentos_chamados to authenticated;
drop policy if exists nao_pendenciamentos_select on public.nao_pendenciamentos_chamados;
create policy nao_pendenciamentos_select on public.nao_pendenciamentos_chamados for select to authenticated using (
  (select public.usuario_e_admin()) or operador_id = (select auth.uid()) or exists (
    select 1 from public.chamados c where c.id = chamado_id and (c.solicitante_id = (select auth.uid()) or c.tecnico_id = (select auth.uid()))
  )
);
drop policy if exists nao_pendenciamentos_insert on public.nao_pendenciamentos_chamados;
create policy nao_pendenciamentos_insert on public.nao_pendenciamentos_chamados for insert to authenticated with check (
  operador_id = (select auth.uid()) and exists (
    select 1 from public.solicitantes_chamados s join public.chamados c on c.solicitante_id = s.user_id
    where s.user_id = (select auth.uid()) and s.ativo = true and c.id = chamado_id
      and c.status in ('aberto','pendente','andamento') and not c.pendencia_ativa
  )
);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nao_pendenciamentos_chamados') then
    alter publication supabase_realtime add table public.nao_pendenciamentos_chamados;
  end if;
end $$;
comment on table public.nao_pendenciamentos_chamados is 'Decisões explícitas do operador de não pendenciar um chamado, com justificativa obrigatória.';
