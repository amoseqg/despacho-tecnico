-- Ajustes financeiros separados da execução técnica; apenas Amós pode alterá-los.
begin;
alter table public.execucoes add column if not exists pagamento_valor_corrigido numeric(14,2);
alter table public.execucoes add column if not exists pagamento_excluido boolean not null default false;
alter table public.execucoes add column if not exists pagamento_revisao integer not null default 0;
alter table public.execucoes add column if not exists pagamento_motivo text;
create schema if not exists privado;
revoke all on schema privado from public;
create table if not exists public.historico_valores_parceiros (
 id uuid primary key default gen_random_uuid(), chamado_id uuid not null,
 responsavel_id uuid not null, criado_em timestamptz not null default now(),
 acao text not null, motivo text not null, anterior jsonb not null, novo jsonb not null
);
alter table public.historico_valores_parceiros enable row level security;
grant select on public.historico_valores_parceiros to authenticated;
create policy historico_valores_amos on public.historico_valores_parceiros for select to authenticated
using ((select auth.uid())='391d92ed-3a0d-42f7-9e5f-e3f5172b3e1b'::uuid and exists(select 1 from public.perfis where id=auth.uid() and tipo='admin' and ativo));
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
  jsonb_build_object('valor',coalesce(old.pagamento_valor_corrigido,old.valor_total),'excluido',old.pagamento_excluido,'revisao',old.pagamento_revisao),
  jsonb_build_object('valor',coalesce(new.pagamento_valor_corrigido,new.valor_total),'excluido',new.pagamento_excluido,'revisao',new.pagamento_revisao));
 end if;
 return new;
end $$;
revoke all on function privado.proteger_ajustes_parceiros() from public;
create trigger proteger_ajustes_parceiros before insert or update on public.execucoes for each row execute function privado.proteger_ajustes_parceiros();
create or replace function public.ajustar_valor_parceiro(p_chamado_id uuid,p_acao text,p_valor numeric,p_motivo text,p_revisao integer)
returns setof public.execucoes language plpgsql security invoker set search_path='' as $$
declare atual public.execucoes;
begin
 if auth.uid() is distinct from '391d92ed-3a0d-42f7-9e5f-e3f5172b3e1b'::uuid or not exists(select 1 from public.perfis where id=auth.uid() and tipo='admin' and ativo) then raise exception 'Acesso exclusivo de Amós.' using errcode='42501'; end if;
 if p_acao not in ('corrigir','excluir','restaurar') or p_acao is null or length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe a ação e o motivo.'; end if;
 if p_acao='corrigir' and (p_valor is null or p_valor<0 or p_valor>999999999999.99 or p_valor::text in ('NaN','Infinity','-Infinity') or p_valor<>round(p_valor,2)) then raise exception 'Informe um valor válido com até duas casas decimais.'; end if;
 select e.* into atual from public.execucoes e join public.chamados c on c.id=e.chamado_id where e.chamado_id=p_chamado_id and c.status='concluida' for update of e;
 if not found then raise exception 'Execução concluída não encontrada.'; end if;
 if atual.pagamento_revisao is distinct from p_revisao then raise exception 'O lançamento foi alterado. Atualize a tela antes de continuar.'; end if;
 if p_acao='corrigir' and atual.pagamento_excluido then raise exception 'Restaure o lançamento antes de corrigir.'; end if;
 return query update public.execucoes set
 pagamento_valor_corrigido=case when p_acao='corrigir' then p_valor else pagamento_valor_corrigido end,
 pagamento_excluido=case when p_acao='excluir' then true when p_acao='restaurar' then false else pagamento_excluido end,
 pagamento_motivo=trim(p_motivo),pagamento_revisao=pagamento_revisao+1,atualizado_em=now()
 where chamado_id=p_chamado_id returning *;
end $$;
revoke all on function public.ajustar_valor_parceiro(uuid,text,numeric,text,integer) from public,anon;
grant execute on function public.ajustar_valor_parceiro(uuid,text,numeric,text,integer) to authenticated;
commit;
