create table public.pedidos_aprovacao_tecnicos (
  tecnico_id uuid primary key references public.perfis(id) on delete cascade,
  numero_pedido text not null check (length(btrim(numero_pedido)) between 1 and 100),
  valor numeric(14,2) not null default 0 check (valor >= 0),
  status text not null default 'aguardando_envio'
    check (status in ('aguardando_envio','enviado')),
  email_destinatario text not null,
  email_enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  criado_por uuid not null references public.perfis(id)
);

comment on table public.pedidos_aprovacao_tecnicos is
  'Pedido atual de emissão de nota fiscal associado ao total de serviços de cada técnico.';

alter table public.pedidos_aprovacao_tecnicos enable row level security;
revoke all on public.pedidos_aprovacao_tecnicos from anon;
grant select, insert, update, delete on public.pedidos_aprovacao_tecnicos to authenticated;

create policy pedidos_aprovacao_admin_select
  on public.pedidos_aprovacao_tecnicos for select to authenticated
  using ((select public.usuario_e_admin()));

create policy pedidos_aprovacao_admin_insert
  on public.pedidos_aprovacao_tecnicos for insert to authenticated
  with check ((select public.usuario_e_admin()) and criado_por=(select auth.uid()));

create policy pedidos_aprovacao_admin_update
  on public.pedidos_aprovacao_tecnicos for update to authenticated
  using ((select public.usuario_e_admin()))
  with check ((select public.usuario_e_admin()));

create policy pedidos_aprovacao_admin_delete
  on public.pedidos_aprovacao_tecnicos for delete to authenticated
  using ((select public.usuario_e_admin()));
