'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type MaterialResumo = {
  id: string;
  nome: string;
  codigo: string | null;
  unidade: string;
  estoque: number;
  ativo: boolean;
};

export type SolicitacaoMaterialResumo = {
  id: string;
  chamado_id: string;
  material_id: string;
  tecnico_id: string;
  quantidade_solicitada: number;
  quantidade_separada: number;
  quantidade_entregue: number;
  status: 'solicitado' | 'direcionado' | 'separado' | 'entregue' | 'cancelado';
  solicitado_em: string;
  direcionado_em: string | null;
  separado_em: string | null;
  entregue_em: string | null;
  observacao: string | null;
  material: { nome: string; unidade: string } | null;
  tecnico: { nome: string } | null;
  chamado: { protocolo: string; site_nome: string | null; cidade: string | null } | null;
};

export async function listarMateriais(): Promise<MaterialResumo[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('materiais')
    .select('id,nome,codigo,unidade,estoque,ativo')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as MaterialResumo[];
}

export async function listarSolicitacoesMaterial(): Promise<SolicitacaoMaterialResumo[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('solicitacoes_material')
    .select('id,chamado_id,material_id,tecnico_id,quantidade_solicitada,quantidade_separada,quantidade_entregue,status,solicitado_em,direcionado_em,separado_em,entregue_em,observacao,material:materiais(nome,unidade),tecnico:perfis!solicitacoes_material_tecnico_id_fkey(nome),chamado:chamados(protocolo,site_nome,cidade)')
    .order('solicitado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SolicitacaoMaterialResumo[];
}

export async function atualizarStatusSolicitacao(id: string, status: SolicitacaoMaterialResumo['status'], quantidade?: number): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const agora = new Date().toISOString();
  const update: Record<string, unknown> = { status, atualizado_em: agora };
  if (status === 'direcionado') update.direcionado_em = agora;
  if (status === 'separado') {
    update.separado_em = agora;
    if (typeof quantidade === 'number') update.quantidade_separada = quantidade;
  }
  if (status === 'entregue') {
    update.entregue_em = agora;
    if (typeof quantidade === 'number') update.quantidade_entregue = quantidade;
  }
  const { error } = await supabase.from('solicitacoes_material').update(update).eq('id', id);
  if (error) throw error;
}
