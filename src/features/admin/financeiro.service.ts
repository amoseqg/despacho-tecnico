'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type PagamentoLinha = {
  execucao_id: string;
  chamado_id: string;
  protocolo: string;
  tecnico_id: string;
  tecnico_nome: string;
  regiao: string;
  atividade: string | null;
  km_total: number;
  valor_km: number;
  valor_atividade: number;
  valor_materiais: number;
  valor_avulso: number;
  valor_total: number;
  concluido_em: string | null;
};

export type DesempenhoLinha = {
  chamado_id: string;
  protocolo: string;
  tecnico_id: string | null;
  tecnico_nome: string | null;
  site_nome: string | null;
  circuito: string | null;
  indicador_sla: string | null;
  horas_atendimento: number | null;
  reincidencias: number | null;
  concluido_em: string | null;
};

export async function listarPagamentos(): Promise<PagamentoLinha[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('execucoes')
    .select('id,chamado_id,tecnico_id,atividade,km_total,valor_km,valor_atividade,valor_materiais,valor_avulso,valor_total,chamados(protocolo,regiao,concluido_em),perfis!execucoes_tecnico_id_fkey(nome)')
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    execucao_id: row.id,
    chamado_id: row.chamado_id,
    protocolo: row.chamados?.protocolo ?? '',
    tecnico_id: row.tecnico_id,
    tecnico_nome: row.perfis?.nome ?? 'Não informado',
    regiao: row.chamados?.regiao ?? '',
    atividade: row.atividade,
    km_total: Number(row.km_total ?? 0),
    valor_km: Number(row.valor_km ?? 0),
    valor_atividade: Number(row.valor_atividade ?? 0),
    valor_materiais: Number(row.valor_materiais ?? 0),
    valor_avulso: Number(row.valor_avulso ?? 0),
    valor_total: Number(row.valor_total ?? 0),
    concluido_em: row.chamados?.concluido_em ?? null,
  }));
}

export async function listarDesempenho(): Promise<DesempenhoLinha[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('vw_chamados_sla')
    .select('id,protocolo,tecnico_id,site_nome,circuito,indicador_sla,horas_atendimento,reincidencias,concluido_em,perfis!chamados_tecnico_id_fkey(nome)')
    .order('concluido_em', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    chamado_id: row.id,
    protocolo: row.protocolo ?? '',
    tecnico_id: row.tecnico_id,
    tecnico_nome: row.perfis?.nome ?? null,
    site_nome: row.site_nome,
    circuito: row.circuito,
    indicador_sla: row.indicador_sla,
    horas_atendimento: row.horas_atendimento == null ? null : Number(row.horas_atendimento),
    reincidencias: row.reincidencias == null ? null : Number(row.reincidencias),
    concluido_em: row.concluido_em,
  }));
}

export function baixarCsv(nome: string, linhas: Record<string, unknown>[]) {
  if (!linhas.length) return;
  const cabecalhos = Object.keys(linhas[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [cabecalhos.map(esc).join(';'), ...linhas.map(l => cabecalhos.map(c => esc(l[c])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
