alter table public.relatorios_vistoria add column if not exists arquivado_em timestamptz, add column if not exists arquivado_por uuid references public.perfis(id);
comment on column public.relatorios_vistoria.arquivado_em is 'Data em que o relatório de vistoria foi arquivado da lista administrativa; o registro e o arquivo permanecem preservados.';
comment on column public.relatorios_vistoria.arquivado_por is 'Perfil administrador que arquivou o relatório de vistoria.';
