alter table public.pedidos_aprovacao_tecnicos
  add column periodo_inicio date,
  add column periodo_fim date;

alter table public.pedidos_aprovacao_tecnicos
  add constraint pedidos_aprovacao_tecnicos_periodo_check
  check (
    (periodo_inicio is null and periodo_fim is null)
    or (periodo_inicio is not null and periodo_fim is not null and periodo_fim >= periodo_inicio)
  );

create table public.pagamentos_periodos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  tecnico_id uuid not null references public.perfis(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  numero_pedido text not null,
  valor numeric not null,
  email_destinatario text not null,
  enviado_em timestamptz not null default now(),
  criado_por uuid not null references public.perfis(id),
  criado_em timestamptz not null default now(),
  constraint pagamentos_periodos_tecnicos_datas_check check (periodo_fim >= periodo_inicio),
  constraint pagamentos_periodos_tecnicos_numero_pedido_check check (length(btrim(numero_pedido)) >= 1 and length(btrim(numero_pedido)) <= 100),
  constraint pagamentos_periodos_tecnicos_valor_check check (valor > 0),
  constraint pagamentos_periodos_tecnicos_periodo_unique unique (tecnico_id, periodo_inicio, periodo_fim)
);

alter table public.pagamentos_periodos_tecnicos enable row level security;
grant select, insert, update, delete on public.pagamentos_periodos_tecnicos to authenticated;

create policy pagamentos_periodos_tecnicos_select
  on public.pagamentos_periodos_tecnicos for select to authenticated
  using ((select public.usuario_e_admin()) or tecnico_id = (select auth.uid()));
create policy pagamentos_periodos_tecnicos_insert
  on public.pagamentos_periodos_tecnicos for insert to authenticated
  with check ((select public.usuario_e_admin()) and criado_por = (select auth.uid()));
create policy pagamentos_periodos_tecnicos_update
  on public.pagamentos_periodos_tecnicos for update to authenticated
  using ((select public.usuario_e_admin()))
  with check ((select public.usuario_e_admin()));
create policy pagamentos_periodos_tecnicos_delete
  on public.pagamentos_periodos_tecnicos for delete to authenticated
  using ((select public.usuario_e_admin()));

create or replace function public.confirmar_pagamento_periodo_tecnico(
  p_tecnico_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_numero_pedido text,
  p_valor numeric,
  p_email_destinatario text
) returns public.pagamentos_periodos_tecnicos
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pedido public.pedidos_aprovacao_tecnicos%rowtype;
  v_pagamento public.pagamentos_periodos_tecnicos%rowtype;
begin
  if (select auth.uid()) is null or not (select public.usuario_e_admin()) then
    raise exception 'Apenas administrador autenticado pode confirmar pagamento.';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Informe um período válido.';
  end if;
  if nullif(btrim(p_numero_pedido), '') is null or p_valor is null or p_valor <= 0 then
    raise exception 'O pedido precisa de número e valor positivo.';
  end if;
  if nullif(btrim(p_email_destinatario), '') is null then
    raise exception 'O e-mail do técnico é obrigatório.';
  end if;

  select * into v_pedido
    from public.pedidos_aprovacao_tecnicos
   where tecnico_id = p_tecnico_id
   for update;

  if not found
     or v_pedido.numero_pedido <> btrim(p_numero_pedido)
     or v_pedido.periodo_inicio is distinct from p_periodo_inicio
     or v_pedido.periodo_fim is distinct from p_periodo_fim
     or v_pedido.valor <> p_valor
     or v_pedido.email_destinatario <> btrim(p_email_destinatario) then
    raise exception 'O pedido salvo não corresponde ao período ou valor informado.';
  end if;

  insert into public.pagamentos_periodos_tecnicos (
    tecnico_id, periodo_inicio, periodo_fim, numero_pedido, valor,
    email_destinatario, enviado_em, criado_por
  ) values (
    p_tecnico_id, p_periodo_inicio, p_periodo_fim, btrim(p_numero_pedido), p_valor,
    btrim(p_email_destinatario), now(), (select auth.uid())
  ) on conflict (tecnico_id, periodo_inicio, periodo_fim) do nothing;

  select * into v_pagamento
    from public.pagamentos_periodos_tecnicos
   where tecnico_id = p_tecnico_id
     and periodo_inicio = p_periodo_inicio
     and periodo_fim = p_periodo_fim
   for update;

  if v_pagamento.numero_pedido <> btrim(p_numero_pedido) or v_pagamento.valor <> p_valor then
    raise exception 'Já existe um pagamento registrado para este período.';
  end if;

  update public.pedidos_aprovacao_tecnicos
     set status = 'enviado',
         email_enviado_em = coalesce(email_enviado_em, now()),
         atualizado_em = now()
   where tecnico_id = p_tecnico_id
     and numero_pedido = btrim(p_numero_pedido)
     and periodo_inicio = p_periodo_inicio
     and periodo_fim = p_periodo_fim;

  return v_pagamento;
end;
$function$;

revoke all on function public.confirmar_pagamento_periodo_tecnico(uuid, date, date, text, numeric, text) from public;
grant execute on function public.confirmar_pagamento_periodo_tecnico(uuid, date, date, text, numeric, text) to authenticated;
