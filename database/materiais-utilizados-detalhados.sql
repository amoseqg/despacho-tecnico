-- Permite que a execução técnica salve vários materiais com quantidade e preço.
-- A coluna é aditiva e mantém compatibilidade com os campos antigos de UTP, CCI e canaleta.
alter table public.execucoes
  add column if not exists materiais_utilizados jsonb not null default '[]'::jsonb;

comment on column public.execucoes.materiais_utilizados is
  'Itens de material informados pelo técnico: nome, unidade, quantidade, valor unitário e total calculado.';
