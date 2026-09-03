-- Excluir da lista preserva o chamado, vínculos, pagamentos e reincidências.
create table public.chamados_arquivados (
 chamado_id uuid primary key references public.chamados(id) on delete restrict,
 ativo boolean not null default true,
 alterado_por uuid not null default auth.uid() references public.perfis(id),
 alterado_em timestamptz not null default now()
);
alter table public.chamados_arquivados enable row level security;
grant select,insert,update on public.chamados_arquivados to authenticated;
create policy arquivo_leitura on public.chamados_arquivados for select to authenticated using (
 public.usuario_e_admin() or exists(select 1 from public.chamados c where c.id=chamado_id and c.tecnico_id=(select auth.uid()))
);
create policy arquivo_insercao on public.chamados_arquivados for insert to authenticated with check (public.usuario_e_admin() and alterado_por=(select auth.uid()));
create policy arquivo_alteracao on public.chamados_arquivados for update to authenticated using(public.usuario_e_admin()) with check(public.usuario_e_admin() and alterado_por=(select auth.uid()));
-- Impede a exclusão física feita por clientes antigos.
drop policy if exists chamados_admin_delete on public.chamados;
revoke delete on public.chamados from authenticated,anon;

create table public.relatorios_vistoria (
 id uuid primary key default gen_random_uuid(),
 chamado_id uuid not null references public.chamados(id) on delete restrict,
 tecnico_id uuid not null default auth.uid() references public.perfis(id),
 caminho text not null unique,
 nome_original text not null check(length(nome_original) between 1 and 255),
 tamanho_bytes bigint not null check(tamanho_bytes>0 and tamanho_bytes<=20971520),
 tipo_mime text not null default 'application/pdf' check(tipo_mime='application/pdf'),
 criado_em timestamptz not null default now(),
 check(caminho=tecnico_id::text||'/'||chamado_id::text||'/'||id::text||'.pdf')
);
create index relatorios_vistoria_chamado on public.relatorios_vistoria(chamado_id);
create index relatorios_vistoria_tecnico on public.relatorios_vistoria(tecnico_id);
alter table public.relatorios_vistoria enable row level security;
grant select,insert on public.relatorios_vistoria to authenticated;
create policy vistoria_leitura on public.relatorios_vistoria for select to authenticated using(
 public.usuario_e_admin() or (tecnico_id=(select auth.uid()) and exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and p.tipo='tecnico'))
);
create policy vistoria_insercao on public.relatorios_vistoria for insert to authenticated with check(
 tecnico_id=(select auth.uid()) and
 exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and p.tipo='tecnico') and
 exists(select 1 from public.chamados c where c.id=chamado_id and c.tecnico_id=(select auth.uid())) and
 exists(select 1 from storage.objects o where o.bucket_id='relatorios-vistoria' and o.name=caminho)
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('relatorios-vistoria','relatorios-vistoria',false,20971520,array['application/pdf']);
create policy vistoria_storage_insercao on storage.objects for insert to authenticated with check(
 bucket_id='relatorios-vistoria' and (storage.foldername(name))[1]=(select auth.uid())::text and
 exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and p.tipo='tecnico') and
 exists(select 1 from public.chamados c where c.id::text=(storage.foldername(name))[2] and c.tecnico_id=(select auth.uid()))
);
create policy vistoria_storage_leitura on storage.objects for select to authenticated using(
 bucket_id='relatorios-vistoria' and (public.usuario_e_admin() or (
 (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.ativo and p.tipo='tecnico')))
);
-- Permite limpar somente uploads próprios que não chegaram a virar relatório.
create policy vistoria_storage_limpeza on storage.objects for delete to authenticated using(
 bucket_id='relatorios-vistoria' and (storage.foldername(name))[1]=(select auth.uid())::text and
 not exists(select 1 from public.relatorios_vistoria r where r.caminho=name)
);
