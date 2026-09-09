-- Portal externo de abertura de chamados do NexoField.
-- O portal usa contas próprias do Supabase Auth e não cria perfis de técnico,
-- administrador ou logística.

create table if not exists public.solicitantes_chamados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 160),
  email text not null unique check (email = lower(trim(email))),
  ativo boolean not null default true,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_solicitantes_chamados_email
  on public.solicitantes_chamados (email);
create index if not exists idx_solicitantes_chamados_ativo
  on public.solicitantes_chamados (ativo);
create index if not exists idx_solicitantes_chamados_criado_por
  on public.solicitantes_chamados (criado_por);

alter table public.solicitantes_chamados enable row level security;

grant select, insert, update, delete on public.solicitantes_chamados to authenticated;

drop policy if exists solicitantes_admin_leitura on public.solicitantes_chamados;
drop policy if exists solicitantes_leitura_propria on public.solicitantes_chamados;
drop policy if exists solicitantes_leitura_autorizada on public.solicitantes_chamados;
create policy solicitantes_leitura_autorizada
  on public.solicitantes_chamados for select to authenticated
  using (public.usuario_e_admin() or (select auth.uid()) = user_id);

drop policy if exists solicitantes_admin_insercao on public.solicitantes_chamados;
create policy solicitantes_admin_insercao
  on public.solicitantes_chamados for insert to authenticated
  with check (public.usuario_e_admin() and criado_por = (select auth.uid()));

drop policy if exists solicitantes_admin_alteracao on public.solicitantes_chamados;
create policy solicitantes_admin_alteracao
  on public.solicitantes_chamados for update to authenticated
  using (public.usuario_e_admin())
  with check (public.usuario_e_admin());

drop policy if exists solicitantes_admin_exclusao on public.solicitantes_chamados;
create policy solicitantes_admin_exclusao
  on public.solicitantes_chamados for delete to authenticated
  using (public.usuario_e_admin());

alter table public.chamados
  add column if not exists solicitante_id uuid references auth.users(id) on delete set null,
  add column if not exists solicitante_nome text,
  add column if not exists solicitante_email text,
  add column if not exists vencimento_em timestamptz;

create index if not exists idx_chamados_solicitante_id
  on public.chamados (solicitante_id);
create index if not exists idx_chamados_vencimento_em
  on public.chamados (vencimento_em);
create unique index if not exists idx_chamados_protocolo_portal_unico
  on public.chamados (protocolo) where solicitante_id is not null;

create sequence if not exists public.protocolo_abertura_seq;
revoke all on sequence public.protocolo_abertura_seq from public, anon;
grant usage, select on sequence public.protocolo_abertura_seq to authenticated;

create or replace function public.preparar_chamado_portal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_solicitante public.solicitantes_chamados%rowtype;
  v_site public.sites%rowtype;
begin
  if new.solicitante_id is null then
    return new;
  end if;

  if new.solicitante_id <> (select auth.uid()) then
    raise exception 'Solicitante inválido.';
  end if;

  select * into v_solicitante
  from public.solicitantes_chamados
  where user_id = (select auth.uid()) and ativo = true;

  if not found then
    raise exception 'Este e-mail não está autorizado para abrir chamados.';
  end if;

  select * into v_site
  from public.sites
  where id = new.site_id and ativo = true;

  if not found then
    raise exception 'Circuito não localizado ou inativo.';
  end if;

  if new.vencimento_em is null or new.vencimento_em <= now() then
    raise exception 'Informe um vencimento futuro.';
  end if;

  new.protocolo := 'NEX-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.protocolo_abertura_seq')::text, 6, '0');
  new.sdm := nullif(trim(new.sdm), '');
  new.abertura_origem := 'Portal de Abertura';
  new.circuito := v_site.circuito;
  new.site_nome := v_site.site;
  new.cidade := v_site.cidade;
  new.endereco := v_site.endereco;
  new.horario_expediente := v_site.horario_expediente;
  new.velocidade := v_site.velocidade;
  new.prtm := v_site.prtm;
  new.pvf_total := v_site.pvf_total;
  new.regiao_operacional := v_site.regiao_operacional;
  new.tecnicos_indicados := v_site.tecnicos_indicados;
  new.regiao := case
    when upper(coalesce(v_site.cidade, '')) like '%FERNANDO DE NORONHA%' then 'noronha'::public.regiao_tipo
    when upper(coalesce(v_site.regiao_operacional, '')) in ('NORTE','SUL','LESTE','OESTE') then 'capital'::public.regiao_tipo
    else 'interior'::public.regiao_tipo
  end;
  new.skill := 'voz';
  new.area := case
    when upper(coalesce(v_site.regiao_operacional, '')) in ('NORTE','SUL','LESTE','OESTE')
      then lower(v_site.regiao_operacional)
    else null
  end;
  new.tecnico_id := null;
  new.criado_por := null;
  new.solicitante_nome := v_solicitante.nome;
  new.solicitante_email := v_solicitante.email;
  new.status := 'aberto';
  new.tipo_os := 'manutencao';
  new.criado_em := now();
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_preparar_chamado_portal on public.chamados;
create trigger trg_preparar_chamado_portal
before insert on public.chamados
for each row execute function public.preparar_chamado_portal();

drop policy if exists chamados_solicitante_insert on public.chamados;
create policy chamados_solicitante_insert
  on public.chamados for insert to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and tecnico_id is null
    and criado_por is null
    and status = 'aberto'
    and exists (
      select 1 from public.solicitantes_chamados s
      where s.user_id = (select auth.uid()) and s.ativo = true
    )
  );

drop policy if exists chamados_solicitante_select on public.chamados;
create policy chamados_solicitante_select
  on public.chamados for select to authenticated
  using (solicitante_id = (select auth.uid()));

-- A consulta dos circuitos permanece disponível para os perfis operacionais e
-- passa a ser permitida também aos solicitantes ativos.
drop policy if exists sites_select_authenticated on public.sites;
create policy sites_select_perfis_ou_solicitantes
  on public.sites for select to authenticated
  using (
    exists (
      select 1 from public.perfis p
      where p.id = (select auth.uid()) and p.ativo = true
    )
    or exists (
      select 1 from public.solicitantes_chamados s
      where s.user_id = (select auth.uid()) and s.ativo = true
    )
  );

comment on table public.solicitantes_chamados is
  'Pessoas autorizadas pelos administradores a usar o portal externo de abertura.';
comment on column public.chamados.vencimento_em is
  'Prazo informado na abertura externa do chamado.';
comment on column public.chamados.solicitante_id is
  'Conta Auth que abriu o chamado no portal externo.';
