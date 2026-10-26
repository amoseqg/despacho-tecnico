alter table public.chamados
  add column if not exists numero_ramal text;

create table if not exists public.aplicacoes_materiais_tecnicos (
  id uuid primary key default gen_random_uuid(),
  tecnico_id uuid not null references public.perfis(id) on delete restrict,
  material_id uuid not null references public.materiais(id) on delete restrict,
  chamado_id uuid not null references public.chamados(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  local_aplicacao text not null check (length(btrim(local_aplicacao)) between 3 and 2000),
  servico_nome text,
  status text not null default 'aguardando_aprovacao'
    check (status = any (array['aguardando_aprovacao','aprovado','reprovado'])),
  motivo_reprovacao text,
  solicitado_em timestamptz not null default now(),
  decidido_por uuid references public.perfis(id) on delete set null,
  decidido_em timestamptz
);

create index if not exists aplicacoes_materiais_tecnicos_tecnico_status_idx
  on public.aplicacoes_materiais_tecnicos (tecnico_id, status, solicitado_em desc);
create index if not exists aplicacoes_materiais_tecnicos_chamado_idx
  on public.aplicacoes_materiais_tecnicos (chamado_id);

alter table public.aplicacoes_materiais_tecnicos enable row level security;

drop policy if exists aplicacoes_material_select on public.aplicacoes_materiais_tecnicos;
create policy aplicacoes_material_select on public.aplicacoes_materiais_tecnicos
for select to authenticated using (
  tecnico_id = (select auth.uid())
  or public.usuario_e_admin()
  or exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.ativo = true
      and (p.tipo = 'logistica'::public.tipo_usuario
        or coalesce(p.areas, '{}'::text[]) @> array['logistica']::text[])
  )
);

drop policy if exists aplicacoes_material_insert_tecnico on public.aplicacoes_materiais_tecnicos;
create policy aplicacoes_material_insert_tecnico on public.aplicacoes_materiais_tecnicos
for insert to authenticated with check (
  tecnico_id = (select auth.uid())
  and exists (
    select 1 from public.perfis p where p.id = (select auth.uid())
      and p.ativo = true and p.tipo = 'tecnico'::public.tipo_usuario
  )
  and status = 'aguardando_aprovacao'
  and decidido_por is null and decidido_em is null and motivo_reprovacao is null
);

drop policy if exists aplicacoes_material_update_logistica on public.aplicacoes_materiais_tecnicos;
create policy aplicacoes_material_update_logistica on public.aplicacoes_materiais_tecnicos
for update to authenticated
using (
  public.usuario_e_admin()
  or exists (
    select 1 from public.perfis p where p.id = (select auth.uid()) and p.ativo = true
      and (p.tipo = 'logistica'::public.tipo_usuario
        or coalesce(p.areas, '{}'::text[]) @> array['logistica']::text[])
  )
)
with check (
  public.usuario_e_admin()
  or exists (
    select 1 from public.perfis p where p.id = (select auth.uid()) and p.ativo = true
      and (p.tipo = 'logistica'::public.tipo_usuario
        or coalesce(p.areas, '{}'::text[]) @> array['logistica']::text[])
  )
);

create or replace function public.validar_decisao_aplicacao_material()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'aguardando_aprovacao' then
    raise exception 'Esta aplicação de material já foi analisada.' using errcode = '42501';
  end if;
  if new.tecnico_id is distinct from old.tecnico_id
    or new.material_id is distinct from old.material_id
    or new.chamado_id is distinct from old.chamado_id
    or new.quantidade is distinct from old.quantidade
    or new.local_aplicacao is distinct from old.local_aplicacao
    or new.servico_nome is distinct from old.servico_nome
    or new.solicitado_em is distinct from old.solicitado_em
  then
    raise exception 'Os dados de aplicação não podem ser alterados após o envio.' using errcode = '42501';
  end if;
  if new.status not in ('aprovado','reprovado')
    or new.decidido_por is distinct from (select auth.uid())
    or new.decidido_em is null
  then
    raise exception 'Informe uma decisão logística válida.' using errcode = '42501';
  end if;
  if new.status = 'reprovado' and length(btrim(coalesce(new.motivo_reprovacao,''))) < 3 then
    raise exception 'Informe o motivo da reprovação.' using errcode = '23514';
  end if;
  if new.status = 'aprovado' and new.motivo_reprovacao is not null then
    raise exception 'A aprovação não pode conter motivo de reprovação.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists aplicacoes_materiais_validar_decisao on public.aplicacoes_materiais_tecnicos;
create trigger aplicacoes_materiais_validar_decisao
before update on public.aplicacoes_materiais_tecnicos
for each row execute function public.validar_decisao_aplicacao_material();

update public.chamados c
set operadora = s.operadora
from public.solicitantes_chamados s
where c.solicitante_id = s.user_id
  and nullif(trim(coalesce(c.operadora,'')), '') is null
  and nullif(trim(coalesce(s.operadora,'')), '') is not null;

create or replace function public.preparar_chamado_portal()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_solicitante public.solicitantes_chamados%rowtype;
  v_site public.sites%rowtype;
begin
  if new.solicitante_id is null then return new; end if;
  if new.solicitante_id <> (select auth.uid()) then raise exception 'Solicitante inválido.'; end if;
  select * into v_solicitante from public.solicitantes_chamados
    where user_id = (select auth.uid()) and ativo = true;
  if not found then raise exception 'Este e-mail não está autorizado para abrir chamados.'; end if;
  select * into v_site from public.sites where id = new.site_id and ativo = true;
  if not found then raise exception 'Circuito não localizado ou inativo.'; end if;
  if new.vencimento_em is null or new.vencimento_em <= now() then raise exception 'Informe um vencimento futuro.'; end if;
  new.protocolo := 'NEX-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.protocolo_abertura_seq')::text, 6, '0');
  new.sdm := nullif(trim(new.sdm), '');
  new.abertura_origem := 'Portal de Abertura';
  new.operadora := v_solicitante.operadora;
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
    when upper(coalesce(v_site.cidade,'')) like '%FERNANDO DE NORONHA%' then 'noronha'::public.regiao_tipo
    when upper(coalesce(v_site.regiao_operacional,'')) in ('NORTE','SUL','LESTE','OESTE') then 'capital'::public.regiao_tipo
    else 'interior'::public.regiao_tipo end;
  new.skill := 'voz';
  new.area := case when upper(coalesce(v_site.regiao_operacional,'')) in ('NORTE','SUL','LESTE','OESTE')
    then lower(v_site.regiao_operacional) else null end;
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

create or replace function private.historico_reincidencia_tecnico(p_chamado_id uuid, p_usuario_id uuid)
returns table(chamado_anterior_id uuid, protocolo_anterior text, tecnico_anterior text, concluido_em timestamptz, acao_realizada text)
language sql stable security definer set search_path = ''
as $function$
  select anterior.id, anterior.protocolo, perfil.nome, anterior.concluido_em,
         coalesce(nullif(execucao.observacao, ''), nullif(execucao.relatorio_encerramento, ''),
                  nullif(execucao.atividade, ''), 'Ação não informada')
  from public.chamados atual
  join public.chamados anterior
    on (
      case
        when lower(translate(coalesce(atual.skill,''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) = 'voz'
          and regexp_replace(lower(translate(coalesce(nullif(atual.operadora,''),nullif(atual.abertura_origem,''),''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')),'[^a-z0-9]','','g') in ('vectra','metodo')
        then 'ramal:' || regexp_replace(coalesce(atual.numero_ramal,''),'[^0-9]','','g')
        else 'circuito:' || regexp_replace(coalesce(atual.circuito,''),'[^0-9]','','g')
      end
    ) = (
      case
        when lower(translate(coalesce(anterior.skill,''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) = 'voz'
          and regexp_replace(lower(translate(coalesce(nullif(anterior.operadora,''),nullif(anterior.abertura_origem,''),''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')),'[^a-z0-9]','','g') in ('vectra','metodo')
        then 'ramal:' || regexp_replace(coalesce(anterior.numero_ramal,''),'[^0-9]','','g')
        else 'circuito:' || regexp_replace(coalesce(anterior.circuito,''),'[^0-9]','','g')
      end
    )
   and anterior.id <> atual.id and anterior.status = 'concluida'
   and anterior.concluido_em is not null and anterior.concluido_em <= atual.criado_em
   and atual.criado_em - anterior.concluido_em < interval '30 days'
  left join public.perfis perfil on perfil.id = anterior.tecnico_id
  left join public.execucoes execucao on execucao.chamado_id = anterior.id
  where atual.id = p_chamado_id and p_usuario_id is not null
    and p_usuario_id = auth.uid() and atual.tecnico_id = p_usuario_id
    and (
      (lower(translate(coalesce(atual.skill,''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) = 'voz'
       and regexp_replace(lower(translate(coalesce(nullif(atual.operadora,''),nullif(atual.abertura_origem,''),''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')),'[^a-z0-9]','','g') in ('vectra','metodo')
       and length(regexp_replace(coalesce(atual.numero_ramal,''),'[^0-9]','','g')) > 0)
      or (not (lower(translate(coalesce(atual.skill,''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')) = 'voz'
       and regexp_replace(lower(translate(coalesce(nullif(atual.operadora,''),nullif(atual.abertura_origem,''),''),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')),'[^a-z0-9]','','g') in ('vectra','metodo'))
       and length(regexp_replace(coalesce(atual.circuito,''),'[^0-9]','','g')) > 0)
    )
  order by anterior.concluido_em desc limit 1;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='aplicacoes_materiais_tecnicos'
  ) then
    execute 'alter publication supabase_realtime add table public.aplicacoes_materiais_tecnicos';
  end if;
end;
$$;
