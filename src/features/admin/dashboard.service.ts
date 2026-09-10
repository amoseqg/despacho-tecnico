'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type DashboardResumo = {
  total: number;
  abertos: number;
  andamento: number;
  pendentes: number;
  concluidos: number;
  cancelados: number;
  reincidencias: number;
  foraSla: number;
};

export async function carregarDashboardResumo(): Promise<DashboardResumo> {
  const supabase = createSupabaseBrowserClient();
  const [{ data: chamados, error: chamadosError }, { data: sla, error: slaError }] = await Promise.all([
    supabase.from('chamados').select('id,status'),
    supabase.from('vw_chamados_sla').select('id,reincidencias,indicador_sla'),
  ]);
  if (chamadosError) throw chamadosError;
  if (slaError) throw slaError;

  const lista = chamados ?? [];
  const listaSla = sla ?? [];
  return {
    total: lista.length,
    abertos: lista.filter(c => c.status === 'aberto').length,
    andamento: lista.filter(c => c.status === 'andamento').length,
    pendentes: lista.filter(c => c.status === 'pendente').length,
    concluidos: lista.filter(c => c.status === 'concluida').length,
    cancelados: lista.filter(c => c.status === 'cancelado').length,
    reincidencias: listaSla.reduce((acc, item) => acc + Number(item.reincidencias ?? 0), 0),
    foraSla: listaSla.filter(item => String(item.indicador_sla ?? '').toLowerCase().includes('fora')).length,
  };
}
