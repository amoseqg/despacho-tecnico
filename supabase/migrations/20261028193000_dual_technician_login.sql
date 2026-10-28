-- Same authenticated account may use the technical area when the profile flag is enabled.
create or replace function public.nf_push_public_key()
returns text
language sql
security definer
set search_path to ''
as $function$
  select public_key
  from nf_push_private.config
  where id
    and exists (
      select 1
      from public.perfis
      where id = auth.uid()
        and ativo
        and (tipo = 'tecnico' or tambem_tecnico)
    )
$function$;

create or replace function public.solicitar_reaprazamento_admin(p_chamado_id uuid, p_motivo text)
returns public.solicitacoes_reaprazamento_admin
language plpgsql
set search_path to ''
as $function$
declare
  t public.perfis;
  c public.chamados;
  r public.solicitacoes_reaprazamento_admin;
begin
  select * into t
  from public.perfis
  where id = auth.uid()
    and (tipo = 'tecnico' or tambem_tecnico)
    and ativo = true;

  if t.id is null then
    raise exception 'Somente técnico ativo pode solicitar reaprazamento.'
      using errcode = '42501';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da solicitação.';
  end if;

  select * into c
  from public.chamados
  where id = p_chamado_id
    and tecnico_id = auth.uid()
  for update;

  if c.id is null or c.status <> 'andamento' then
    raise exception 'O chamado não está em atendimento com este técnico.';
  end if;

  if exists (
    select 1
    from public.solicitacoes_reaprazamento_admin
    where chamado_id = c.id and status = 'solicitada'
  ) then
    raise exception 'Já existe uma solicitação de reaprazamento aguardando o administrador.';
  end if;

  insert into public.solicitacoes_reaprazamento_admin(
    chamado_id, tecnico_id, tecnico_nome, motivo, vencimento_anterior
  )
  values (c.id, t.id, t.nome, trim(p_motivo), c.vencimento_em)
  returning * into r;

  return r;
exception
  when unique_violation then
    raise exception 'Já existe uma solicitação de reaprazamento aguardando o administrador.';
end
$function$;

drop policy if exists aplicacoes_material_insert_tecnico on public.aplicacoes_materiais_tecnicos;
create policy aplicacoes_material_insert_tecnico on public.aplicacoes_materiais_tecnicos
for insert to authenticated with check (
  tecnico_id = (select auth.uid())
  and exists (select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and (p.tipo='tecnico' or p.tambem_tecnico))
  and status='aguardando_aprovacao'
  and decidido_por is null and decidido_em is null and motivo_reprovacao is null
);

drop policy if exists mensagens_chat_insert_remetente on public.mensagens_chat;
create policy mensagens_chat_insert_remetente on public.mensagens_chat
for insert to authenticated with check (
  remetente_id = (select auth.uid())
  and (
    tecnico_id = (select auth.uid())
    or (
      (public.usuario_e_admin() or exists (
        select 1 from public.perfis p
        where p.id=(select auth.uid()) and p.tipo='logistica' and p.ativo
      ))
      and exists (
        select 1 from public.perfis tecnico
        where tecnico.id=mensagens_chat.tecnico_id
          and (tecnico.tipo='tecnico' or tecnico.tambem_tecnico)
          and tecnico.ativo
      )
    )
  )
);

drop policy if exists presenca_tecnicos_insert on public.presenca_tecnicos;
create policy presenca_tecnicos_insert on public.presenca_tecnicos
for insert to authenticated with check (
  tecnico_id = (select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id=presenca_tecnicos.tecnico_id
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
);

drop policy if exists presenca_tecnicos_update on public.presenca_tecnicos;
create policy presenca_tecnicos_update on public.presenca_tecnicos
for update to authenticated
using (tecnico_id = (select auth.uid()))
with check (
  tecnico_id = (select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id=presenca_tecnicos.tecnico_id
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
);

drop policy if exists rastreamento_tecnico_insere_proprio on public.rastreamento_tecnico;
create policy rastreamento_tecnico_insere_proprio on public.rastreamento_tecnico
for insert to authenticated with check (
  tecnico_id = (select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id=(select auth.uid())
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
  and exists (
    select 1 from public.chamados c
    where c.id=rastreamento_tecnico.chamado_id
      and c.tecnico_id=(select auth.uid())
      and c.status='andamento'
  )
);

drop policy if exists vistoria_insercao on public.relatorios_vistoria;
create policy vistoria_insercao on public.relatorios_vistoria
for insert to authenticated with check (
  tecnico_id=(select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id=(select auth.uid())
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
  and exists (
    select 1 from public.chamados c
    where c.id=relatorios_vistoria.chamado_id
      and c.tecnico_id=(select auth.uid())
  )
  and exists (
    select 1 from storage.objects o
    where o.bucket_id='relatorios-vistoria'
      and o.name=relatorios_vistoria.caminho
  )
);

drop policy if exists vistoria_leitura on public.relatorios_vistoria;
create policy vistoria_leitura on public.relatorios_vistoria
for select to authenticated using (
  public.usuario_e_admin()
  or (
    tecnico_id=(select auth.uid())
    and exists (
      select 1 from public.perfis p
      where p.id=(select auth.uid())
        and (p.tipo='tecnico' or p.tambem_tecnico)
        and p.ativo
    )
  )
);

drop policy if exists solicitacoes_reaprazamento_insert on public.solicitacoes_reaprazamento_admin;
create policy solicitacoes_reaprazamento_insert on public.solicitacoes_reaprazamento_admin
for insert to authenticated with check (
  tecnico_id=(select auth.uid())
  and status='solicitada'
  and decidido_por is null and decidido_em is null and novo_vencimento is null
  and exists (
    select 1 from public.perfis perfil
    where perfil.id=(select auth.uid())
      and (perfil.tipo='tecnico' or perfil.tambem_tecnico)
      and perfil.ativo
  )
  and exists (
    select 1 from public.chamados chamado
    where chamado.id=solicitacoes_reaprazamento_admin.chamado_id
      and chamado.tecnico_id=(select auth.uid())
      and chamado.status='andamento'
  )
);

drop policy if exists push_proprio on public.tecnico_push_subscriptions;
create policy push_proprio on public.tecnico_push_subscriptions
for all to authenticated
using (tecnico_id=(select auth.uid()))
with check (
  tecnico_id=(select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id=(select auth.uid())
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
);

drop policy if exists vistoria_storage_insercao on storage.objects;
create policy vistoria_storage_insercao on storage.objects
for insert to authenticated with check (
  bucket_id='relatorios-vistoria'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1 from public.perfis p
    where p.id=(select auth.uid())
      and (p.tipo='tecnico' or p.tambem_tecnico)
      and p.ativo
  )
  and exists (
    select 1 from public.chamados c
    where c.id::text=(storage.foldername(objects.name))[2]
      and c.tecnico_id=(select auth.uid())
  )
);

drop policy if exists vistoria_storage_leitura on storage.objects;
create policy vistoria_storage_leitura on storage.objects
for select to authenticated using (
  bucket_id='relatorios-vistoria'
  and (
    public.usuario_e_admin()
    or (
      (storage.foldername(name))[1]=(select auth.uid())::text
      and exists (
        select 1 from public.perfis p
        where p.id=(select auth.uid())
          and (p.tipo='tecnico' or p.tambem_tecnico)
          and p.ativo
      )
    )
  )
);
