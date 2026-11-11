'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import type { PerfilDb } from '@/src/features/auth/perfil.service';

export type ChamadoResumo = {
  id: string;
  protocolo: string;
  sdm: string | null;
  circuito: string;
  site_nome: string | null;
  cidade: string | null;
  status: 'aberto' | 'pendente' | 'andamento' | 'recusado' | 'concluida' | 'cancelado';
  tecnico_id: string | null;
  atividade_servico: string | null;
  criado_em: string;
};

export type ReincidenciaResumo = {
  chamado_anterior_id: string;
  protocolo_anterior: string;
  tecnico_anterior: string;
  acao_realizada: string;
  concluido_em: string;
};

export async function listarChamados(perfil: PerfilDb): Promise<ChamadoResumo[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from('chamados')
    .select('id,protocolo,sdm,circuito,site_nome,cidade,status,tecnico_id,atividade_servico,criado_em')
    .neq('status', 'cancelado')
    .order('criado_em', { ascending: false })
    .limit(100);

  if (perfil.tipo === 'tecnico') query = query.eq('tecnico_id', perfil.id);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ChamadoResumo[];
}

export async function obterReincidencia(chamadoId: string): Promise<ReincidenciaResumo | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc('obter_reincidencia_chamado', { p_chamado_id: chamadoId });
  if (error) throw error;
  return (data?.[0] as ReincidenciaResumo | undefined) ?? null;
}
