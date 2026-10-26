alter table public.solicitacoes_material
  alter column chamado_id drop not null,
  add column if not exists avulso boolean not null default false,
  add column if not exists motivo_solicitacao text,
  add column if not exists status_aprovacao text not null default 'nao_aplicavel',
  add column if not exists motivo_reprovacao text,
  add column if not exists aprovado_por uuid references public.perfis(id),
  add column if not exists aprovado_em timestamptz;

alter table public.solicitacoes_material
  drop constraint if exists solicitacoes_material_status_aprovacao_check,
  add constraint solicitacoes_material_status_aprovacao_check
    check (status_aprovacao = any (array['nao_aplicavel','aguardando','aprovado','reprovado'])),
  drop constraint if exists solicitacoes_material_avulso_check,
  add constraint solicitacoes_material_avulso_check
    check ((avulso = false and status_aprovacao = 'nao_aplicavel')
      or (avulso = true and length(btrim(coalesce(motivo_solicitacao,''))) between 3 and 2000));

drop policy if exists solmat_tecnico_insert on public.solicitacoes_material;
create policy solmat_tecnico_insert on public.solicitacoes_material for insert to authenticated
with check (tecnico_id = (select auth.uid()) and (
  (avulso = false and status_aprovacao = 'nao_aplicavel')
  or (avulso = true and status_aprovacao = 'aguardando'
      and aprovado_por is null and aprovado_em is null and motivo_reprovacao is null)
));

create or replace function public.proteger_decisao_material_avulso()
returns trigger language plpgsql set search_path = ''
as $$
declare v_logistica boolean;
begin
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.ativo = true
      and (p.tipo = 'logistica'::public.tipo_usuario
        or coalesce(p.areas, '{}'::text[]) @> array['logistica']::text[])
  ) into v_logistica;

  if old.avulso and not (public.usuario_e_admin() or v_logistica)
    and (new.avulso is distinct from old.avulso
      or new.motivo_solicitacao is distinct from old.motivo_solicitacao
      or new.status_aprovacao is distinct from old.status_aprovacao
      or new.motivo_reprovacao is distinct from old.motivo_reprovacao
      or new.aprovado_por is distinct from old.aprovado_por
      or new.aprovado_em is distinct from old.aprovado_em)
  then
    raise exception 'Somente a Administração ou Logística pode decidir uma solicitação avulsa.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists solicitacoes_material_proteger_decisao_avulsa on public.solicitacoes_material;
create trigger solicitacoes_material_proteger_decisao_avulsa
before update on public.solicitacoes_material
for each row execute function public.proteger_decisao_material_avulso();
