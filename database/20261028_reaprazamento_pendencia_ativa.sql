create or replace function public.reaprazar_pendencia_expediente_admin(
  p_pendencia_id uuid,
  p_novo_vencimento timestamptz,
  p_motivo_reaprazamento text
)
returns public.pendencias_expediente_admin
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  c public.chamados;
  a public.perfis;
  r public.pendencias_expediente_admin;
  prazo_segundos bigint;
  motivo_final text;
begin
  select * into a
  from public.perfis
  where id = auth.uid() and tipo = 'admin' and ativo = true;

  if a.id is null then
    raise exception 'Somente administrador ativo pode reaprazar o prazo.'
      using errcode = '42501';
  end if;

  if p_novo_vencimento is null
     or length(trim(coalesce(p_motivo_reaprazamento, ''))) < 3 then
    raise exception 'Informe um novo vencimento e o motivo do reaprazamento.';
  end if;

  select c1.* into c
  from public.chamados c1
  join public.pendencias_expediente_admin p on p.chamado_id = c1.id
  where p.id = p_pendencia_id
  for update of c1;

  select * into r
  from public.pendencias_expediente_admin
  where id = p_pendencia_id
  for update;

  if r.id is null
     or r.status <> 'pausado'
     or c.id is null
     or not c.pendencia_ativa
     or c.status not in ('aberto', 'pendente', 'andamento') then
    raise exception 'O chamado não possui pendência ativa para reaprazar.';
  end if;

  if exists (
    select 1
    from public.pendencias_expediente_admin outra
    where outra.chamado_id = c.id
      and outra.status = 'pausado'
      and outra.id <> r.id
  ) then
    raise exception 'Existe outra pendência ativa para este chamado.';
  end if;

  if p_novo_vencimento <= greatest(
    coalesce(r.vencimento_reprogramado, r.retorno_em),
    r.retorno_em,
    now()
  ) then
    raise exception 'O novo vencimento deve ser posterior ao prazo atual e ao retorno programado.';
  end if;

  prazo_segundos := floor(extract(epoch from p_novo_vencimento - r.retorno_em))::bigint;
  if prazo_segundos <= 0 then
    raise exception 'Informe um prazo adicional maior que zero.';
  end if;

  if not privado.expediente_valido(
    r.retorno_em,
    r.inicio_expediente,
    r.fim_expediente,
    r.dias_expediente,
    r.dias_sem_expediente,
    prazo_segundos
  ) then
    raise exception 'O novo vencimento precisa respeitar o expediente e os feriados cadastrados.';
  end if;

  motivo_final := trim(r.motivo)
    || E'\n\nReaprazamento adicional ('
    || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    || ' — '
    || trim(a.nome)
    || '): '
    || trim(p_motivo_reaprazamento);

  if length(motivo_final) > 2000 then
    raise exception 'Reduza o motivo para que o histórico não ultrapasse 2000 caracteres.';
  end if;

  update public.pendencias_expediente_admin
  set vencimento_reprogramado = p_novo_vencimento,
      prazo_restante_segundos = prazo_segundos,
      motivo = motivo_final
  where id = r.id
  returning * into r;

  update public.chamados
  set vencimento_em = p_novo_vencimento,
      atualizado_em = now()
  where id = c.id;

  return r;
end
$function$;

revoke all on function public.reaprazar_pendencia_expediente_admin(uuid, timestamptz, text)
  from public, anon;
grant execute on function public.reaprazar_pendencia_expediente_admin(uuid, timestamptz, text)
  to authenticated;