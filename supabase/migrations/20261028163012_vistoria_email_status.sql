alter table public.relatorios_vistoria
  add column if not exists email_destinatario text,
  add column if not exists email_preparado_em timestamptz;

comment on column public.relatorios_vistoria.email_destinatario
  is 'Endereço destinatário do rascunho aberto no Outlook pelo administrador.';
comment on column public.relatorios_vistoria.email_preparado_em
  is 'Horário em que o rascunho de e-mail foi preparado no Outlook; não confirma o envio.';

revoke update on table public.relatorios_vistoria from anon, authenticated;
grant update (email_destinatario, email_preparado_em)
  on table public.relatorios_vistoria to authenticated;

drop policy if exists vistoria_admin_registrar_email_preparado
  on public.relatorios_vistoria;
create policy vistoria_admin_registrar_email_preparado
  on public.relatorios_vistoria
  for update
  to authenticated
  using ((select public.usuario_e_admin()))
  with check ((select public.usuario_e_admin()));
