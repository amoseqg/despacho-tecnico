begin;
alter table public.execucoes add column if not exists deslocamento_cobrado boolean not null default false;
-- Mantém o deslocamento dos registros anteriores; novos exigem confirmação.
update public.execucoes set deslocamento_cobrado=(coalesce(valor_km,0)>0);
create or replace function privado.normalizar_deslocamento() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.km_total<0 or new.km_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Distância inválida.'; end if;
 new.valor_km:=case when new.deslocamento_cobrado then round(greatest(coalesce(new.km_total,0)-40,0),2) else 0 end;
 new.valor_total:=coalesce(new.valor_atividade,0)+coalesce(new.valor_materiais,0)+new.valor_km;
 return new;
end $$;
revoke all on function privado.normalizar_deslocamento() from public;
create trigger a_normalizar_deslocamento before insert or update on public.execucoes for each row execute function privado.normalizar_deslocamento();
create or replace function privado.datas_encerramento_servidor() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='concluida' then
  if TG_OP='INSERT' then new.concluido_em:=now();
  elsif old.status is distinct from 'concluida' or old.concluido_em is null then new.concluido_em:=now();
  else new.concluido_em:=old.concluido_em;
  end if;
 end if;
 return new;
end $$;
revoke all on function privado.datas_encerramento_servidor() from public;
create trigger datas_encerramento_servidor before insert or update on public.chamados for each row execute function privado.datas_encerramento_servidor();
create or replace function privado.datas_aprovacao_servidor() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then new.atualizado_em:=now();
 elsif row(new.status,new.administrador_id,new.observacao,new.reenviado) is distinct from row(old.status,old.administrador_id,old.observacao,old.reenviado) then new.atualizado_em:=now();
 else new.atualizado_em:=old.atualizado_em;
 end if;
 return new;
end $$;
revoke all on function privado.datas_aprovacao_servidor() from public;
create trigger datas_aprovacao_servidor before insert or update on public.aprovacoes for each row execute function privado.datas_aprovacao_servidor();
create or replace function privado.proteger_ajustes_parceiros() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (TG_OP='INSERT' and (new.pagamento_valor_corrigido is not null or new.pagamento_excluido or new.pagamento_revisao<>0 or new.pagamento_motivo is not null))
 or (TG_OP='UPDATE' and row(new.pagamento_valor_corrigido,new.pagamento_excluido,new.pagamento_revisao,new.pagamento_motivo) is distinct from row(old.pagamento_valor_corrigido,old.pagamento_excluido,old.pagamento_revisao,old.pagamento_motivo)) then
  if auth.uid() is distinct from '391d92ed-3a0d-42f7-9e5f-e3f5172b3e1b'::uuid or not exists(select 1 from public.perfis where id=auth.uid() and tipo='admin' and ativo) then
   raise exception 'Somente Amós pode alterar os ajustes financeiros.' using errcode='42501';
  end if;
  if TG_OP='INSERT' then raise exception 'Cadastre a execução antes de ajustar o pagamento.'; end if;
  if new.pagamento_valor_corrigido<0 or new.pagamento_valor_corrigido::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(new.pagamento_motivo,'')))<3 then raise exception 'Valor ou motivo inválido.'; end if;
  new.pagamento_revisao:=old.pagamento_revisao+1;
  insert into public.historico_valores_parceiros(chamado_id,responsavel_id,acao,motivo,anterior,novo)
  values(new.chamado_id,auth.uid(),case when new.pagamento_excluido and not old.pagamento_excluido then 'excluir' when old.pagamento_excluido and not new.pagamento_excluido then 'restaurar' else 'corrigir' end,new.pagamento_motivo,
  jsonb_build_object('valor',coalesce(old.pagamento_valor_corrigido,old.valor_total),'excluido',old.pagamento_excluido,'revisao',old.pagamento_revisao,'km',old.km_total,'valorKm',old.valor_km,'cobrarKm',old.deslocamento_cobrado),
  jsonb_build_object('valor',coalesce(new.pagamento_valor_corrigido,new.valor_total),'excluido',new.pagamento_excluido,'revisao',new.pagamento_revisao,'km',new.km_total,'valorKm',new.valor_km,'cobrarKm',new.deslocamento_cobrado));
 end if;
 return new;
end $$;

-- O titular informou ausência de deslocamento no protocolo 3674307.
-- Mantém o total corrigido manualmente pelo titular (R$ 120,00).
select set_config('request.jwt.claims','{"sub":"391d92ed-3a0d-42f7-9e5f-e3f5172b3e1b","role":"authenticated"}',true);
update public.execucoes set km_total=0,valor_km=0,deslocamento_cobrado=false,
 pagamento_motivo='Correção solicitada por Amós: atividade de 08/10/2026 sem cobrança de deslocamento; valor corrigido preservado.',
 pagamento_revisao=pagamento_revisao+1,atualizado_em=now()
where chamado_id='0cb422f3-acea-4ddf-ad7a-8890d216b869' and km_total=210 and valor_km=170;
commit;
