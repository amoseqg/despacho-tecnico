-- Allow an admin to fulfill a technician's pending request by creating the actual
-- administrative business-hours pause, while preserving the ticket's remaining SLA.
CREATE OR REPLACE FUNCTION public.pendenciar_expediente_admin(p_chamado_id uuid, p_retorno timestamp with time zone, p_inicio time without time zone, p_fim time without time zone, p_dias integer[], p_feriados date[], p_motivo text)
 RETURNS public.pendencias_expediente_admin
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.chamados;
  a public.perfis;
  r public.pendencias_expediente_admin;
  solicitacao_tecnico public.solicitacoes_pendencia;
  restante bigint;
  limite timestamptz;
begin
  select * into a
  from public.perfis
  where id = auth.uid() and tipo = 'admin' and ativo = true;

  if a.id is null then
    raise exception 'Somente administrador ativo pode pendenciar.'
      using errcode = '42501';
  end if;

  if p_retorno is null or p_retorno <= now()
     or p_inicio is null or p_fim is null or p_inicio >= p_fim
     or p_dias is null or cardinality(p_dias) = 0
     or not p_dias <@ array[0,1,2,3,4,5,6]
     or p_feriados is null
     or length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe retorno futuro, expediente, dias válidos e motivo.';
  end if;

  select * into c
  from public.chamados
  where id = p_chamado_id
  for update;

  if c.id is null or c.status not in ('aberto', 'pendente', 'andamento') then
    raise exception 'Chamado não está ativo.';
  end if;

  select * into solicitacao_tecnico
  from public.solicitacoes_pendencia
  where chamado_id = c.id
    and origem = 'tecnico'
    and status = 'solicitada'
  order by solicitado_em desc
  limit 1
  for update;

  if c.pendencia_ativa
     or exists (
       select 1 from public.solicitacoes_pendencia
       where chamado_id = c.id and status = 'aprovada'
     )
     or exists (
       select 1 from public.solicitacoes_pendencia
       where chamado_id = c.id
         and status = 'solicitada'
         and origem is distinct from 'tecnico'
     ) then
    raise exception 'Este chamado já possui uma pendência.';
  end if;

  limite := coalesce(
    c.vencimento_em,
    coalesce(c.iniciado_em, c.aceito_em, c.criado_em)
      + case when c.regiao = 'interior' then interval '8 hours' else interval '6 hours' end
      + make_interval(secs => c.prazo_pausado_segundos::double precision)
  );
  restante := floor(extract(epoch from limite - now()))::bigint;

  if restante <= 0 then
    raise exception 'O prazo já venceu. A pendência não remove uma perda de prazo anterior.';
  end if;

  if not privado.expediente_valido(p_retorno, p_inicio, p_fim, p_dias, p_feriados, restante) then
    raise exception 'Escolha retorno em dia de expediente, com tempo restante suficiente até o fechamento. Confira os feriados informados.';
  end if;

  insert into public.pendencias_expediente_admin(
    chamado_id, administrador_id, administrador_nome, motivo,
    inicio_expediente, fim_expediente, dias_expediente, dias_sem_expediente,
    retorno_em, prazo_restante_segundos, vencimento_anterior, vencimento_reprogramado
  )
  values (
    c.id, a.id, a.nome, trim(p_motivo),
    p_inicio, p_fim, p_dias, p_feriados,
    p_retorno, restante, c.vencimento_em,
    p_retorno + make_interval(secs => restante::double precision)
  )
  returning * into r;

  update public.chamados
  set pendencia_ativa = true,
      pendencia_desde = now(),
      vencimento_em = r.vencimento_reprogramado,
      atualizado_em = now()
  where id = c.id;

  if solicitacao_tecnico.id is not null then
    update public.solicitacoes_pendencia
    set status = 'encerrada',
        decidido_por = a.id,
        decidido_por_nome = a.nome,
        decisao_mensagem = 'Solicitação atendida pela pendência administrativa de horário. Motivo: ' || trim(p_motivo),
        aprazado_para = r.vencimento_reprogramado,
        saida_programada_em = p_retorno,
        decidido_em = now(),
        encerrado_em = now(),
        atualizado_em = now()
    where chamado_id = c.id
      and origem = 'tecnico'
      and status = 'solicitada';
  end if;

  return r;
end
$function$
;

CREATE OR REPLACE FUNCTION public.pendenciar_expediente_admin_reaprazado(p_chamado_id uuid, p_retorno timestamp with time zone, p_inicio time without time zone, p_fim time without time zone, p_dias integer[], p_feriados date[], p_motivo text, p_novo_vencimento timestamp with time zone, p_motivo_reaprazamento text)
 RETURNS public.pendencias_expediente_admin
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.chamados;
  a public.perfis;
  r public.pendencias_expediente_admin;
  solicitacao_tecnico public.solicitacoes_pendencia;
  limite timestamptz;
  restante bigint;
  motivo_final text;
begin
  select * into a
  from public.perfis
  where id = auth.uid() and tipo = 'admin' and ativo = true;

  if a.id is null then
    raise exception 'Somente administrador ativo pode reaprazar o prazo.'
      using errcode = '42501';
  end if;

  if p_retorno is null or p_retorno <= now()
     or p_inicio is null or p_fim is null or p_inicio >= p_fim
     or p_dias is null or cardinality(p_dias) = 0
     or not p_dias <@ array[0,1,2,3,4,5,6]
     or p_feriados is null
     or length(trim(coalesce(p_motivo, ''))) < 3
     or p_novo_vencimento is null
     or length(trim(coalesce(p_motivo_reaprazamento, ''))) < 3 then
    raise exception 'Informe retorno futuro, expediente, dias válidos, novo vencimento e motivo do reaprazamento.';
  end if;

  select * into c
  from public.chamados
  where id = p_chamado_id
  for update;

  if c.id is null or c.status not in ('aberto', 'pendente', 'andamento') then
    raise exception 'Chamado não está ativo.';
  end if;

  select * into solicitacao_tecnico
  from public.solicitacoes_pendencia
  where chamado_id = c.id
    and origem = 'tecnico'
    and status = 'solicitada'
  order by solicitado_em desc
  limit 1
  for update;

  if c.pendencia_ativa
     or exists (
       select 1 from public.solicitacoes_pendencia
       where chamado_id = c.id and status = 'aprovada'
     )
     or exists (
       select 1 from public.solicitacoes_pendencia
       where chamado_id = c.id
         and status = 'solicitada'
         and origem is distinct from 'tecnico'
     ) then
    raise exception 'Este chamado já possui uma pendência.';
  end if;

  limite := coalesce(
    c.vencimento_em,
    coalesce(c.iniciado_em, c.aceito_em, c.criado_em)
      + case when c.regiao = 'interior' then interval '8 hours' else interval '6 hours' end
      + make_interval(secs => c.prazo_pausado_segundos::double precision)
  );
  restante := floor(extract(epoch from limite - now()))::bigint;

  if restante > 0 then
    raise exception 'O prazo ainda não venceu. Use a pendência normal para preservar o tempo restante.';
  end if;

  if p_novo_vencimento <= p_retorno then
    raise exception 'O novo vencimento deve ser posterior à data de retorno programada.';
  end if;

  restante := floor(extract(epoch from p_novo_vencimento - p_retorno))::bigint;
  if restante <= 0 then
    raise exception 'Informe um prazo adicional maior que zero.';
  end if;

  motivo_final := trim(p_motivo)
    || E'\n\nMotivo do reaprazamento: '
    || trim(p_motivo_reaprazamento);

  if length(motivo_final) > 2000 then
    raise exception 'Reduza os textos dos motivos para que o histórico não ultrapasse 2000 caracteres.';
  end if;

  if not privado.expediente_valido(p_retorno, p_inicio, p_fim, p_dias, p_feriados, restante) then
    raise exception 'O novo vencimento deve caber no expediente informado e respeitar feriados e dias de funcionamento.';
  end if;

  insert into public.pendencias_expediente_admin(
    chamado_id, administrador_id, administrador_nome, motivo,
    inicio_expediente, fim_expediente, dias_expediente, dias_sem_expediente,
    retorno_em, prazo_restante_segundos, vencimento_anterior, vencimento_reprogramado
  )
  values (
    c.id, a.id, a.nome, motivo_final,
    p_inicio, p_fim, p_dias, p_feriados, p_retorno, restante,
    c.vencimento_em,
    p_retorno + make_interval(secs => restante::double precision)
  )
  returning * into r;

  update public.chamados
  set pendencia_ativa = true,
      pendencia_desde = now(),
      vencimento_em = r.vencimento_reprogramado,
      atualizado_em = now()
  where id = c.id;

  if solicitacao_tecnico.id is not null then
    update public.solicitacoes_pendencia
    set status = 'encerrada',
        decidido_por = a.id,
        decidido_por_nome = a.nome,
        decisao_mensagem = 'Solicitação atendida pela pendência administrativa de horário. Motivo: '
          || trim(p_motivo) || ' Motivo do reaprazamento: ' || trim(p_motivo_reaprazamento),
        aprazado_para = r.vencimento_reprogramado,
        saida_programada_em = p_retorno,
        decidido_em = now(),
        encerrado_em = now(),
        atualizado_em = now()
    where chamado_id = c.id
      and origem = 'tecnico'
      and status = 'solicitada';
  end if;

  return r;
end
$function$
;

REVOKE EXECUTE ON FUNCTION public.pendenciar_expediente_admin(uuid, timestamp with time zone, time without time zone, time without time zone, integer[], date[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pendenciar_expediente_admin_reaprazado(uuid, timestamp with time zone, time without time zone, time without time zone, integer[], date[], text, timestamp with time zone, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendenciar_expediente_admin(uuid, timestamp with time zone, time without time zone, time without time zone, integer[], date[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pendenciar_expediente_admin_reaprazado(uuid, timestamp with time zone, time without time zone, time without time zone, integer[], date[], text, timestamp with time zone, text) TO authenticated, service_role;
