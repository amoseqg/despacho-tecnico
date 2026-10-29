-- Allow an administrator to decide a reaprazamento request that was opened
-- while the call was active, even if the call was completed before review.
-- The approval changes the due date only; it does not reopen the call.
CREATE OR REPLACE FUNCTION public.decidir_reaprazamento_admin(
  p_solicitacao_id uuid,
  p_decisao text,
  p_novo_vencimento timestamp with time zone,
  p_resposta text
)
RETURNS public.solicitacoes_reaprazamento_admin
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
  a public.perfis;
  c public.chamados;
  r public.solicitacoes_reaprazamento_admin;
  pe public.pendencias_expediente_admin;
  vencimento_base timestamptz;
  prazo_segundos bigint;
begin
  select * into a
  from public.perfis
  where id = auth.uid() and tipo = 'admin' and ativo = true;

  if a.id is null then
    raise exception 'Somente administrador ativo pode decidir a solicitação.'
      using errcode = '42501';
  end if;

  if p_decisao is null or p_decisao not in ('aprovada', 'rejeitada')
     or length(trim(coalesce(p_resposta, ''))) < 3 then
    raise exception 'Informe a decisão e a resposta ao técnico.';
  end if;

  select c1.* into c
  from public.chamados c1
  join public.solicitacoes_reaprazamento_admin s on s.chamado_id = c1.id
  where s.id = p_solicitacao_id
  for update of c1;

  select * into r
  from public.solicitacoes_reaprazamento_admin
  where id = p_solicitacao_id
  for update;

  if r.id is null or r.status <> 'solicitada' or c.id is null
     or c.status not in ('aberto', 'pendente', 'andamento', 'concluida') then
    raise exception 'A solicitação não está mais pendente ou o chamado não está ativo.';
  end if;

  if p_decisao = 'aprovada' then
    if p_novo_vencimento is null
       or p_novo_vencimento <= greatest(now(), coalesce(c.vencimento_em, now())) then
      raise exception 'O novo vencimento deve ser posterior ao prazo atual e ao momento da aprovação.';
    end if;

    select * into pe
    from public.pendencias_expediente_admin
    where chamado_id = c.id and status = 'pausado'
    order by criado_em desc
    limit 1
    for update;

    if pe.id is not null then
      vencimento_base := greatest(now(), pe.retorno_em);
      if p_novo_vencimento <= vencimento_base then
        raise exception 'O novo vencimento deve ser posterior ao retorno programado.';
      end if;
      prazo_segundos := floor(extract(epoch from p_novo_vencimento - vencimento_base))::bigint;
      if prazo_segundos <= 0 then
        raise exception 'Informe um prazo adicional maior que zero.';
      end if;

      update public.pendencias_expediente_admin
      set retorno_em = vencimento_base,
          vencimento_reprogramado = p_novo_vencimento,
          prazo_restante_segundos = prazo_segundos
      where id = pe.id;
    end if;

    update public.chamados
    set vencimento_em = p_novo_vencimento,
        atualizado_em = now()
    where id = c.id;
  elsif p_novo_vencimento is not null then
    raise exception 'A recusa da solicitação não deve alterar o vencimento.';
  end if;

  update public.solicitacoes_reaprazamento_admin
  set status = p_decisao,
      novo_vencimento = case when p_decisao = 'aprovada' then p_novo_vencimento else null end,
      decidido_por = a.id,
      decidido_por_nome = a.nome,
      resposta_admin = trim(p_resposta),
      decidido_em = now(),
      atualizado_em = now()
  where id = r.id
  returning * into r;

  return r;
end
$function$;
