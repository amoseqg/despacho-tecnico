-- Otimiza políticas RLS sem alterar quem pode acessar cada linha.
-- auth.uid() é avaliado uma vez por consulta, em vez de uma vez por linha.

ALTER POLICY aprovacoes_select ON public.aprovacoes
  USING (
    usuario_e_admin()
    OR EXISTS (
      SELECT 1
      FROM public.chamados c
      WHERE c.id = aprovacoes.chamado_id
        AND c.tecnico_id = (SELECT auth.uid())
    )
  );

ALTER POLICY transferencias_select ON public.chamado_transferencias
  USING (
    usuario_e_admin()
    OR de_tecnico_id = (SELECT auth.uid())
    OR para_tecnico_id = (SELECT auth.uid())
  );

ALTER POLICY chamados_select_admin_ou_tecnico ON public.chamados
  USING (usuario_e_admin() OR tecnico_id = (SELECT auth.uid()));

ALTER POLICY chamados_tecnico_update_proprio ON public.chamados
  USING (tecnico_id = (SELECT auth.uid()))
  WITH CHECK (tecnico_id = (SELECT auth.uid()));

ALTER POLICY execucoes_select ON public.execucoes
  USING (usuario_e_admin() OR tecnico_id = (SELECT auth.uid()));

ALTER POLICY execucoes_tecnico_insert ON public.execucoes
  WITH CHECK (tecnico_id = (SELECT auth.uid()));

ALTER POLICY execucoes_tecnico_update ON public.execucoes
  USING (tecnico_id = (SELECT auth.uid()))
  WITH CHECK (tecnico_id = (SELECT auth.uid()));

ALTER POLICY expediente_admin_insert ON public.pendencias_expediente_admin
  WITH CHECK (
    (SELECT usuario_e_admin())
    AND administrador_id = (SELECT auth.uid())
  );

ALTER POLICY expediente_admin_select ON public.pendencias_expediente_admin
  USING (
    (SELECT usuario_e_admin())
    OR EXISTS (
      SELECT 1
      FROM public.chamados c
      WHERE c.id = pendencias_expediente_admin.chamado_id
        AND c.tecnico_id = (SELECT auth.uid())
    )
  );

ALTER POLICY perfis_select_authenticated ON public.perfis
  USING (ativo = true OR id = (SELECT auth.uid()) OR usuario_e_admin());

ALTER POLICY solmat_select ON public.solicitacoes_material
  USING (usuario_e_admin() OR tecnico_id = (SELECT auth.uid()));

ALTER POLICY push_proprio ON public.tecnico_push_subscriptions
  USING (tecnico_id = (SELECT auth.uid()))
  WITH CHECK (
    tecnico_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.perfis
      WHERE perfis.id = (SELECT auth.uid())
        AND perfis.tipo = 'tecnico'::tipo_usuario
        AND perfis.ativo
    )
  );
