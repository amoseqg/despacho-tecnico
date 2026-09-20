-- Materiais retirados da planta, recuperação para o estoque e auditoria logística.
create table if not exists public.materiais_retirados (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  site_planta text not null check (length(trim(site_planta)) between 2 and 240),
  protocolo_os text,
  condicao text not null default 'aguardando_avaliacao'
    check (condicao in ('aguardando_avaliacao','avariado','reparavel','recuperado')),
  observacao text,
  status text not null default 'retirado' check (status in ('retirado','recuperado_estoque')),
  retirado_por uuid not null default auth.uid() references public.perfis(id) on delete restrict,
  retirado_em timestamptz not null default now(),
  recuperado_por uuid references public.perfis(id) on delete set null,
  recuperado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.materiais_retirados enable row level security;
grant select, insert, update on public.materiais_retirados to authenticated;

drop policy if exists materiais_retirados_select on public.materiais_retirados;
create policy materiais_retirados_select on public.materiais_retirados for select to authenticated
using (exists (
  select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true
  and (p.tipo in ('admin','logistica') or coalesce(p.areas,'{}'::text[]) @> array['logistica'])
));

drop policy if exists materiais_retirados_insert on public.materiais_retirados;
create policy materiais_retirados_insert on public.materiais_retirados for insert to authenticated
with check (retirado_por=(select auth.uid()) and exists (
  select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true
  and (p.tipo in ('admin','logistica') or coalesce(p.areas,'{}'::text[]) @> array['logistica'])
));

drop policy if exists materiais_retirados_update on public.materiais_retirados;
create policy materiais_retirados_update on public.materiais_retirados for update to authenticated
using (exists (
  select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true
  and (p.tipo in ('admin','logistica') or coalesce(p.areas,'{}'::text[]) @> array['logistica'])
))
with check (exists (
  select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo=true
  and (p.tipo in ('admin','logistica') or coalesce(p.areas,'{}'::text[]) @> array['logistica'])
));

create or replace function public.ajustar_estoque_logistico(
  p_material_id uuid,
  p_nova_quantidade numeric,
  p_observacao text default null
) returns public.materiais
language plpgsql security invoker set search_path=public
as $$
declare v_material public.materiais; v_anterior numeric;
begin
  if p_nova_quantidade < 0 then raise exception 'Quantidade inválida'; end if;
  select * into v_material from public.materiais where id=p_material_id for update;
  if not found then raise exception 'Material não encontrado'; end if;
  v_anterior:=v_material.estoque;
  update public.materiais set estoque=p_nova_quantidade,atualizado_em=now()
    where id=p_material_id returning * into v_material;
  insert into public.movimentacoes_estoque(material_id,tipo,quantidade,estoque_anterior,estoque_novo,observacao,realizado_por)
    values(p_material_id,'ajuste',p_nova_quantidade-v_anterior,v_anterior,p_nova_quantidade,p_observacao,(select auth.uid()));
  return v_material;
end $$;

create or replace function public.registrar_retirada_planta(
  p_material_id uuid,p_quantidade numeric,p_site_planta text,p_protocolo_os text,
  p_condicao text,p_observacao text
) returns public.materiais_retirados
language plpgsql security invoker set search_path=public
as $$
declare v_retirada public.materiais_retirados; v_estoque numeric;
begin
  select estoque into v_estoque from public.materiais where id=p_material_id;
  insert into public.materiais_retirados(material_id,quantidade,site_planta,protocolo_os,condicao,observacao,retirado_por)
    values(p_material_id,p_quantidade,trim(p_site_planta),nullif(trim(p_protocolo_os),''),p_condicao,nullif(trim(p_observacao),''),(select auth.uid()))
    returning * into v_retirada;
  insert into public.movimentacoes_estoque(material_id,tipo,quantidade,estoque_anterior,estoque_novo,observacao,realizado_por)
    values(p_material_id,'retirada_planta',p_quantidade,v_estoque,v_estoque,
      concat('Retirada ',v_retirada.id,' | ',trim(p_site_planta),case when nullif(trim(p_protocolo_os),'') is null then '' else ' | '||trim(p_protocolo_os) end),
      (select auth.uid()));
  return v_retirada;
end $$;

create or replace function public.recuperar_material_estoque(p_retirada_id uuid)
returns public.materiais_retirados
language plpgsql security invoker set search_path=public
as $$
declare v_retirada public.materiais_retirados; v_anterior numeric; v_novo numeric;
begin
  select * into v_retirada from public.materiais_retirados where id=p_retirada_id for update;
  if not found then raise exception 'Retirada não encontrada'; end if;
  if v_retirada.status='recuperado_estoque' then raise exception 'Material já encaminhado ao estoque'; end if;
  select estoque into v_anterior from public.materiais where id=v_retirada.material_id for update;
  v_novo:=v_anterior+v_retirada.quantidade;
  update public.materiais set estoque=v_novo,atualizado_em=now() where id=v_retirada.material_id;
  update public.materiais_retirados set status='recuperado_estoque',condicao='recuperado',recuperado_por=(select auth.uid()),recuperado_em=now(),atualizado_em=now()
    where id=p_retirada_id returning * into v_retirada;
  insert into public.movimentacoes_estoque(material_id,tipo,quantidade,estoque_anterior,estoque_novo,observacao,realizado_por)
    values(v_retirada.material_id,'recuperado_estoque',v_retirada.quantidade,v_anterior,v_novo,'Recuperação da retirada '||v_retirada.id,(select auth.uid()));
  return v_retirada;
end $$;

revoke all on function public.ajustar_estoque_logistico(uuid,numeric,text) from public,anon;
revoke all on function public.registrar_retirada_planta(uuid,numeric,text,text,text,text) from public,anon;
revoke all on function public.recuperar_material_estoque(uuid) from public,anon;
grant execute on function public.ajustar_estoque_logistico(uuid,numeric,text) to authenticated;
grant execute on function public.registrar_retirada_planta(uuid,numeric,text,text,text,text) to authenticated;
grant execute on function public.recuperar_material_estoque(uuid) to authenticated;
