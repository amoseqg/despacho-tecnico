alter table public.perfis
  add column if not exists tambem_tecnico boolean not null default false;

update public.perfis
set tambem_tecnico = true,
    atualizado_em = now()
where lower(email) = lower('streamingtech100@gmail.com')
  and tipo = 'admin';
