create or replace function public.registrar_lancamento_manual_pagamento(
  p_tecnico_id uuid,
  p_protocolo text,
  p_sdm text,
  p_circuito text,
  p_site text,
  p_cidade text,
  p_skill text,
  p_servico text,
  p_descricao text,
  p_valor numeric,
  p_data date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.perfis%rowtype;
  v_tecnico public.perfis%rowtype;
  v_chamado_id uuid;
  v_concluido_em timestamptz;
  v_obs text;
begin
  select * into v_admin
  from public.perfis
  where id = auth.uid()
    and tipo = 'admin'::public.tipo_usuario
    and admin_geral = true
    and lower(trim(coalesce(email, ''))) = 'amos.gomes@metodotelecom.com.br'
    and ativo = true;

  if not found then
    raise exception 'Apenas o Administrador Geral autorizado pode registrar pagamentos manuais.'
      using errcode = '42501';
  end if;

  select * into v_tecnico
  from public.perfis
  where id = p_tecnico_id
    and ativo = true
    and (tipo = 'tecnico'::public.tipo_usuario or tambem_tecnico = true);

  if not found then
    raise exception 'O técnico selecionado não está ativo ou não possui perfil técnico.'
      using errcode = '22023';
  end if;

  if length(trim(coalesce(p_protocolo, ''))) < 1
     or length(trim(coalesce(p_protocolo, ''))) > 100 then
    raise exception 'Informe um protocolo com até 100 caracteres.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_site, ''))) < 2
     or length(trim(coalesce(p_site, ''))) > 250 then
    raise exception 'Informe o site ou cliente.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_servico, ''))) < 2
     or length(trim(coalesce(p_servico, ''))) > 200 then
    raise exception 'Informe o serviço realizado.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > 1000000 then
    raise exception 'O valor precisa ser maior que zero e menor que R$ 1.000.000.' using errcode = '22023';
  end if;
  if p_data is null then
    raise exception 'Informe a data de contabilização.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(p_protocolo))));
  if exists (
    select 1 from public.chamados
    where lower(trim(protocolo)) = lower(trim(p_protocolo))
  ) then
    raise exception 'Já existe um chamado com esse protocolo.' using errcode = '23505';
  end if;

  v_concluido_em := (p_data::timestamp + interval '12 hours') at time zone 'America/Recife';
  v_obs := 'Lançamento manual de pagamento pelo Administrador Geral ' || v_admin.nome
      || coalesce(' — ' || nullif(trim(p_descricao), ''), '');

  insert into public.chamados (
    protocolo, sdm, abertura_origem, circuito, site_nome, cidade, regiao, skill,
    tecnico_id, criado_por, descricao, data_execucao, status, criado_em,
    concluido_em, atualizado_em, tipo_os
  ) values (
    trim(p_protocolo), nullif(trim(coalesce(p_sdm, '')), ''),
    'Lançamento manual de pagamento', trim(coalesce(p_circuito, '')),
    trim(p_site), nullif(trim(coalesce(p_cidade, '')), ''),
    coalesce(v_tecnico.regiao, 'capital'::public.regiao_tipo),
    coalesce(nullif(trim(p_skill), ''), 'dados'),
    v_tecnico.id, v_admin.id, v_obs, p_data, 'concluida'::public.status_chamado,
    now(), v_concluido_em, now(), 'manutencao'
  ) returning id into v_chamado_id;

  insert into public.execucoes (
    chamado_id, tecnico_id, atividade, valor_atividade, valor_total,
    observacao, relatorio_encerramento, atualizado_em
  ) values (
    v_chamado_id, v_tecnico.id, trim(p_servico), p_valor, p_valor,
    v_obs, nullif(trim(coalesce(p_descricao, '')), ''), now()
  );

  insert into public.aprovacoes (
    chamado_id, status, observacao, administrador_id, reenviado, atualizado_em
  ) values (
    v_chamado_id, 'aprovado'::public.status_aprovacao, v_obs, v_admin.id, false, now()
  );

  return v_chamado_id;
end;
$$;

revoke all on function public.registrar_lancamento_manual_pagamento(uuid,text,text,text,text,text,text,text,text,numeric,date) from public, anon;
grant execute on function public.registrar_lancamento_manual_pagamento(uuid,text,text,text,text,text,text,text,text,numeric,date) to authenticated;