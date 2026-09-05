-- Rastreamento do técnico durante chamados em atendimento.
create table if not exists public.rastreamento_tecnico (
 id uuid primary key default gen_random_uuid(),
 chamado_id uuid not null references public.chamados(id) on delete cascade,
 tecnico_id uuid not null references public.perfis(id) on delete restrict,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 precisao_metros double precision check(precisao_metros is null or precisao_metros >= 0),
 registrado_em timestamptz not null default now()
);
create index if not exists rastreamento_tecnico_chamado_data
 on public.rastreamento_tecnico(chamado_id, registrado_em desc);
create index if not exists rastreamento_tecnico_tecnico_data
 on public.rastreamento_tecnico(tecnico_id, registrado_em desc);
alter table public.rastreamento_tecnico enable row level security;
grant select, insert on public.rastreamento_tecnico to authenticated;
drop policy if exists rastreamento_leitura_autorizada on public.rastreamento_tecnico;
create policy rastreamento_leitura_autorizada
 on public.rastreamento_tecnico for select to authenticated
 using (exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and p.tipo='admin'));
drop policy if exists rastreamento_tecnico_insere_proprio on public.rastreamento_tecnico;
create policy rastreamento_tecnico_insere_proprio
 on public.rastreamento_tecnico for insert to authenticated
 with check (
  tecnico_id = (select auth.uid())
  and exists (
   select 1 from public.perfis p
   where p.id = (select auth.uid()) and p.ativo and p.tipo = 'tecnico'
  )
  and exists (
   select 1 from public.chamados c
   where c.id = chamado_id
     and c.tecnico_id = (select auth.uid())
     and c.status = 'andamento'
  )
 );
comment on table public.rastreamento_tecnico is
 'Posições compartilhadas pelo técnico somente durante chamados aceitos e em atendimento.';
