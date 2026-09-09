-- Cadastro de circuitos por solicitantes autorizados e sequência externa a partir de 1000.

alter table public.sites
  add column if not exists cadastrado_por_solicitante uuid references auth.users(id) on delete set null;

create index if not exists idx_sites_cadastrado_por_solicitante
  on public.sites (cadastrado_por_solicitante)
  where cadastrado_por_solicitante is not null;

grant select, insert on public.sites to authenticated;

drop policy if exists sites_solicitante_insert on public.sites;
create policy sites_solicitante_insert
  on public.sites for insert to authenticated
  with check (
    cadastrado_por_solicitante = (select auth.uid())
    and ativo = true
    and length(trim(circuito)) between 1 and 120
    and length(trim(site)) between 2 and 240
    and length(trim(coalesce(cidade, ''))) between 2 and 160
    and length(trim(coalesce(endereco, ''))) between 3 and 500
    and length(trim(coalesce(horario_expediente, ''))) between 2 and 200
    and velocidade is null
    and prtm is null
    and pvf_total is null
    and regiao_operacional is null
    and tecnicos_indicados is null
    and exists (
      select 1 from public.solicitantes_chamados s
      where s.user_id = (select auth.uid()) and s.ativo = true
    )
  );

select setval(
  'public.protocolo_abertura_seq',
  greatest((select last_value from public.protocolo_abertura_seq), 999),
  true
);

comment on column public.sites.cadastrado_por_solicitante is
  'Solicitante autorizado que cadastrou o circuito pelo portal externo.';
