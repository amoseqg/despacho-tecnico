create or replace function public.pendenciar_expediente_admin_reaprazado(
 p_chamado_id uuid,
 p_retorno timestamptz,
 p_inicio time,
 p_fim time,
 p_dias integer[],
 p_feriados date[],
 p_motivo text,
 p_novo_vencimento timestamptz,
 p_motivo_reaprazamento text
)
returns public.pendencias_expediente_admin
language plpgsql
security invoker
set search_path=''
as $$
declare
 c public.chamados;
 a public.perfis;
 r public.pendencias_expediente_admin;
 limite timestamptz;
 restante bigint;
 motivo_final text;
begin
 select * into a
 from public.perfis
 where id=auth.uid() and tipo='admin' and ativo;
 if a.id is null then
  raise exception 'Somente administrador ativo pode reaprazar o prazo.' using errcode='42501';
 end if;

 if p_retorno is null or p_retorno<=now()
    or p_inicio is null or p_fim is null or p_inicio>=p_fim
    or p_dias is null or cardinality(p_dias)=0
    or not p_dias<@array[0,1,2,3,4,5,6]
    or p_feriados is null
    or length(trim(coalesce(p_motivo,'')))<3
    or p_novo_vencimento is null
    or length(trim(coalesce(p_motivo_reaprazamento,'')))<3 then
  raise exception 'Informe retorno futuro, expediente, dias válidos, novo vencimento e motivo do reaprazamento.';
 end if;

 select * into c from public.chamados where id=p_chamado_id for update;
 if c.id is null or c.status not in ('aberto','pendente','andamento') then
  raise exception 'Chamado não está ativo.';
 end if;
 if c.pendencia_ativa or exists(
  select 1 from public.solicitacoes_pendencia
  where chamado_id=c.id and status in ('solicitada','aprovada')
 ) then
  raise exception 'Este chamado já possui uma pendência.';
 end if;

 limite:=coalesce(
  c.vencimento_em,
  coalesce(c.iniciado_em,c.aceito_em,c.criado_em)
    + case when c.regiao='interior' then interval '8 hours' else interval '6 hours' end
    + make_interval(secs=>c.prazo_pausado_segundos::double precision)
 );
 restante:=floor(extract(epoch from limite-now()))::bigint;
 if restante>0 then
  raise exception 'O prazo ainda não venceu. Use a pendência normal para preservar o tempo restante.';
 end if;

 if p_novo_vencimento<=p_retorno then
  raise exception 'O novo vencimento deve ser posterior à data de retorno programada.';
 end if;

 restante:=floor(extract(epoch from p_novo_vencimento-p_retorno))::bigint;
 if restante<=0 then
  raise exception 'Informe um prazo adicional maior que zero.';
 end if;

 motivo_final:=trim(p_motivo)||E'\n\nMotivo do reaprazamento: '||trim(p_motivo_reaprazamento);
 if length(motivo_final)>2000 then
  raise exception 'Reduza os textos dos motivos para que o histórico não ultrapasse 2000 caracteres.';
 end if;

 if not privado.expediente_valido(p_retorno,p_inicio,p_fim,p_dias,p_feriados,restante) then
  raise exception 'O novo vencimento deve caber no expediente informado e respeitar feriados e dias de funcionamento.';
 end if;

 insert into public.pendencias_expediente_admin(
  chamado_id,administrador_id,administrador_nome,motivo,inicio_expediente,fim_expediente,
  dias_expediente,dias_sem_expediente,retorno_em,prazo_restante_segundos,
  vencimento_anterior,vencimento_reprogramado
 ) values(
  c.id,a.id,a.nome,motivo_final,p_inicio,p_fim,p_dias,p_feriados,p_retorno,
  restante,c.vencimento_em,p_retorno+make_interval(secs=>restante::double precision)
 ) returning * into r;

 update public.chamados
 set pendencia_ativa=true,pendencia_desde=now(),
     vencimento_em=r.vencimento_reprogramado,atualizado_em=now()
 where id=c.id;

 return r;
end $$;

revoke all on function public.pendenciar_expediente_admin_reaprazado(uuid,timestamptz,time,time,integer[],date[],text,timestamptz,text) from public,anon;
grant execute on function public.pendenciar_expediente_admin_reaprazado(uuid,timestamptz,time,time,integer[],date[],text,timestamptz,text) to authenticated;
