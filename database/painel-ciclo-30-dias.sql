create table if not exists public.painel_configuracoes (
  administrador_id uuid primary key references public.perfis(id) on delete cascade,
  zerar_30_dias boolean not null default false,
  inicio_ciclo timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.painel_configuracoes enable row level security;
grant select, insert, update on public.painel_configuracoes to authenticated;
create policy painel_config_admin_select on public.painel_configuracoes for select to authenticated
using (administrador_id=(select auth.uid()) and (select public.usuario_e_admin()));
create policy painel_config_admin_insert on public.painel_configuracoes for insert to authenticated
with check (administrador_id=(select auth.uid()) and (select public.usuario_e_admin()));
create policy painel_config_admin_update on public.painel_configuracoes for update to authenticated
using (administrador_id=(select auth.uid()) and (select public.usuario_e_admin()))
with check (administrador_id=(select auth.uid()) and (select public.usuario_e_admin()));
