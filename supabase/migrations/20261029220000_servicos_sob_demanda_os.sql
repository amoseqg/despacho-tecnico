alter table public.chamados
  drop constraint if exists chamados_atividade_servico_check;

alter table public.chamados
  add constraint chamados_atividade_servico_check
  check (
    atividade_servico is null
    or atividade_servico = any (
      array['instalacao', 'alteracao', 'mudanca_endereco', 'vistoria', 'retirada', 'sob_demanda']::text[]
    )
  );
