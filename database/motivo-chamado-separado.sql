-- Mantém o motivo operacional em campo próprio, separado da descrição livre.
alter table public.chamados
add column if not exists motivo_chamado text;

comment on column public.chamados.motivo_chamado is
'Motivo operacional do chamado, separado da descrição livre.';

-- Converte chamados criados pela versão 1.2.0 sem perder informações.
update public.chamados
set
  motivo_chamado = coalesce(
    nullif(btrim(substring(descricao from '(?im)^MOTIVO DO CHAMADO:\s*(.+)$')), ''),
    motivo_chamado
  ),
  descricao = nullif(
    btrim(regexp_replace(descricao, '(?im)^\s*MOTIVO DO CHAMADO:\s*.*(?:\r?\n)?', '', 'g')),
    ''
  )
where descricao ~* '(?m)^\s*MOTIVO DO CHAMADO:';

