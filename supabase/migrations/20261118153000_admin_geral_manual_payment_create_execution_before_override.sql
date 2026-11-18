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
  v_chamado public.chamados%rowtype;
  v_chamado_id uuid;
  v_tecnico_anterior uuid;
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
    raise exception 'Apenas o Administrador Geral autorizado pode registrar pagamentos manuais.' using errcode = '42501';
  end if;

  select * into v_tecnico
  from public.perfis
  where id = p_tecnico_id and ativo = true
    and (tipo = 'tecnico'::public.tipo_usuario or tambem_tecnico = true);
  if not found then
    raise exception 'O técnico selecionado não está ativo ou não possui perfil técnico.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_protocolo, ''))) < 1 or length(trim(coalesce(p_protocolo, ''))) > 100 then
    raise exception 'Informe um protocolo com até 100 caracteres.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_site, ''))) < 2 or length(trim(coalesce(p_site, ''))) > 250 then
    raise exception 'Informe o site ou cliente.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_servico, ''))) < 2 or length(trim(coalesce(p_servico, ''))) > 200 then
    raise exception 'Informe o serviço realizado.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > 1000000 then
    raise exception 'O valor precisa ser maior que zero e menor que R$ 1.000.000.' using errcode = '22023';
  end if;
  if p_data is null then
    raise exception 'Informe a data de contabilização.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(p_protocolo))));
  select * into v_chamado
  from public.chamados
  where lower(trim(protocolo)) = lower(trim(p_protocolo))
  order by criado_em desc
  limit 1;

  v_concluido_em := (p_data::timestamp + interval '12 hours') at time zone 'America/Recife';
  v_obs := 'Lançamento manual de pagamento pelo Administrador Geral ' || v_admin.nome
      || coalesce(' — ' || nullif(trim(p_descricao), ''), '');

  if found then
    v_chamado_id := v_chamado.id;
    v_tecnico_anterior := v_chamado.tecnico_id;
    update public.chamados set
      sdm=coalesce(nullif(trim(coalesce(p_sdm,'')),''),sdm),
      circuito=coalesce(nullif(trim(coalesce(p_circuito,'')),''),circuito),
      site_nome=trim(p_site),
      cidade=coalesce(nullif(trim(coalesce(p_cidade,'')),''),cidade),
      regiao=coalesce(v_tecnico.regiao,regiao,'capital'::public.regiao_tipo),
      skill=coalesce(nullif(trim(p_skill),''),skill),
      tecnico_id=v_tecnico.id,
      data_execucao=p_data,
      status='concluida'::public.status_chamado,
      concluido_em=v_concluido_em,
      atualizado_em=now()
    where id=v_chamado_id;

    if v_tecnico_anterior is distinct from v_tecnico.id then
      insert into public.chamado_transferencias(chamado_id,de_tecnico_id,para_tecnico_id,motivo,realizado_por,criado_em)
      values(v_chamado_id,v_tecnico_anterior,v_tecnico.id,'Protocolo reaproveitado em lançamento manual de pagamento pelo Administrador Geral '||v_admin.nome,v_admin.id,now());
    end if;
  else
    insert into public.chamados (
      protocolo, sdm, abertura_origem, circuito, site_nome, cidade, regiao, skill,
      tecnico_id, criado_por, descricao, data_execucao, status, criado_em,
      concluido_em, atualizado_em, tipo_os
    ) values (
      trim(p_protocolo), nullif(trim(coalesce(p_sdm,'')), ''),
      'Lançamento manual de pagamento', trim(coalesce(p_circuito,'')),
      trim(p_site), nullif(trim(coalesce(p_cidade,'')), ''),
      coalesce(v_tecnico.regiao,'capital'::public.regiao_tipo),
      coalesce(nullif(trim(p_skill),''),'dados'),
      v_tecnico.id,v_admin.id,v_obs,p_data,'concluida'::public.status_chamado,
      now(),v_concluido_em,now(),'manutencao'
    ) returning id into v_chamado_id;
  end if;

  -- Insere ou atualiza os campos da execução sem enviar os campos financeiros protegidos
  -- no INSERT. A política financeira permite esses campos somente em UPDATE.
  insert into public.execucoes (
    chamado_id, tecnico_id, atividade, valor_atividade, valor_total,
    observacao, relatorio_encerramento, atualizado_em
  ) values (
    v_chamado_id, v_tecnico.id, trim(p_servico), p_valor, p_valor,
    v_obs, nullif(trim(coalesce(p_descricao, '')), ''), now()
  )
  on conflict (chamado_id) do update set
    tecnico_id=excluded.tecnico_id,
    atividade=excluded.atividade,
    valor_atividade=excluded.valor_atividade,
    valor_total=excluded.valor_total,
    observacao=coalesce(public.execucoes.observacao,excluded.observacao),
    relatorio_encerramento=coalesce(public.execucoes.relatorio_encerramento,excluded.relatorio_encerramento),
    atualizado_em=now();

  -- O ajuste é feito em UPDATE para passar pelo registro de histórico financeiro.
  update public.execucoes set
    pagamento_valor_corrigido=p_valor,
    pagamento_motivo=v_obs,
    pagamento_excluido=false,
    atualizado_em=now()
  where chamado_id=v_chamado_id;

  insert into public.aprovacoes(chamado_id,status,observacao,administrador_id,reenviado,atualizado_em)
  values(v_chamado_id,'aprovado'::public.status_aprovacao,v_obs,v_admin.id,false,now())
  on conflict(chamado_id) do update set
    status='aprovado'::public.status_aprovacao,
    observacao=excluded.observacao,
    administrador_id=excluded.administrador_id,
    reenviado=false,
    atualizado_em=now();

  return v_chamado_id;
end;
$$;

revoke all on function public.registrar_lancamento_manual_pagamento(uuid,text,text,text,text,text,text,text,text,numeric,date) from public, anon;
grant execute on function public.registrar_lancamento_manual_pagamento(uuid,text,text,text,text,text,text,text,text,numeric,date) to authenticated;