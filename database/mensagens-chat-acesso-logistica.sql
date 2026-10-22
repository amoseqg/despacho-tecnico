-- Permite que o perfil Logística participe da caixa compartilhada de conversas
-- com técnicos, sem ampliar as permissões de envio dos perfis técnicos.
alter policy mensagens_chat_select_participantes
on public.mensagens_chat
using (
  usuario_e_admin()
  or tecnico_id = (select auth.uid())
  or exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.tipo = 'logistica'::tipo_usuario
      and p.ativo = true
  )
);

alter policy mensagens_chat_insert_remetente
on public.mensagens_chat
with check (
  remetente_id = (select auth.uid())
  and (
    tecnico_id = (select auth.uid())
    or (
      (
        usuario_e_admin()
        or exists (
          select 1
          from public.perfis p
          where p.id = (select auth.uid())
            and p.tipo = 'logistica'::tipo_usuario
            and p.ativo = true
        )
      )
      and exists (
        select 1
        from public.perfis tecnico
        where tecnico.id = mensagens_chat.tecnico_id
          and tecnico.tipo = 'tecnico'::tipo_usuario
          and tecnico.ativo = true
      )
    )
  )
);
