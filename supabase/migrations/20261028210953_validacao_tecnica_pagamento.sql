alter table public.execucoes
  add column if not exists validacao_tecnica_status text not null default 'aguardando_validacao',
  add column if not exists validacao_tecnica_motivo text,
  add column if not exists validacao_tecnica_em timestamptz,
  add column if not exists validacao_tecnica_revisao integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.execucoes'::regclass and conname='execucoes_validacao_tecnica_status_check'
  ) then
    alter table public.execucoes add constraint execucoes_validacao_tecnica_status_check
      check (validacao_tecnica_status in ('validado','aguardando_validacao','nao_validado'));
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.execucoes'::regclass and conname='execucoes_validacao_tecnica_motivo_check'
  ) then
    alter table public.execucoes add constraint execucoes_validacao_tecnica_motivo_check
      check (validacao_tecnica_status <> 'nao_validado' or length(trim(coalesce(validacao_tecnica_motivo,''))) >= 3);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.execucoes'::regclass and conname='execucoes_validacao_tecnica_revisao_check'
  ) then
    alter table public.execucoes add constraint execucoes_validacao_tecnica_revisao_check
      check (validacao_tecnica_revisao >= 0);
  end if;
end $$;

comment on column public.execucoes.validacao_tecnica_status is
  'Validação do técnico para pagamento: aguardando_validacao, validado ou nao_validado.';
comment on column public.execucoes.validacao_tecnica_motivo is
  'Motivo mais recente da não validação técnica do serviço.';
comment on column public.execucoes.validacao_tecnica_em is
  'Data e hora da decisão ou do reenvio para validação técnica.';
comment on column public.execucoes.validacao_tecnica_revisao is
  'Número de ciclos de validação técnica realizados.';
