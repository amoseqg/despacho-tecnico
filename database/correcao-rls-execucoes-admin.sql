-- Permite que administradores encerrem chamados em nome do técnico responsável.
-- O técnico continua limitado aos próprios registros.

drop policy if exists execucoes_admin_insert on public.execucoes;
create policy execucoes_admin_insert
on public.execucoes
for insert
to authenticated
with check ((select public.usuario_e_admin()));

drop policy if exists execucoes_admin_update on public.execucoes;
create policy execucoes_admin_update
on public.execucoes
for update
to authenticated
using ((select public.usuario_e_admin()))
with check ((select public.usuario_e_admin()));
