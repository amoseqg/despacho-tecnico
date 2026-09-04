'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type TecnicoResumo = {
  id: string;
  nome: string;
  email: string | null;
  usuario: string;
  regiao: 'capital' | 'interior' | 'noronha' | null;
  skills: string[];
  areas: string[];
  ativo: boolean;
};

export type ChamadoAdminResumo = {
  id: string;
  protocolo: string;
  sdm: string | null;
  os_pe_conectado: string | null;
  circuito: string;
  site_nome: string | null;
  cidade: string | null;
  atividade_servico: string | null;
  status: string;
  tecnico_id: string | null;
  criado_por: string | null;
  criado_em: string;
  concluido_em: string | null;
};

export async function pesquisarTecnicos(termo: string): Promise<TecnicoResumo[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from('perfis')
    .select('id,nome,email,usuario,regiao,skills,areas,ativo')
    .eq('tipo', 'tecnico')
    .order('nome');

  const busca = termo.trim();
  if (busca) query = query.or(`nome.ilike.%${busca}%,usuario.ilike.%${busca}%,email.ilike.%${busca}%`);

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data ?? []) as TecnicoResumo[];
}

export async function listarChamadosAdmin(termo = ''): Promise<ChamadoAdminResumo[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from('chamados')
    .select('id,protocolo,sdm,os_pe_conectado,circuito,site_nome,cidade,atividade_servico,status,tecnico_id,criado_por,criado_em,concluido_em')
    .order('criado_em', { ascending: false });

  const busca = termo.trim();
  if (busca) query = query.or(`protocolo.ilike.%${busca}%,sdm.ilike.%${busca}%,circuito.ilike.%${busca}%,site_nome.ilike.%${busca}%`);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data ?? []) as ChamadoAdminResumo[];
}

export async function arquivarChamado(chamadoId: string, adminId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('chamados_arquivados')
    .upsert({ chamado_id: chamadoId, alterado_por: adminId, ativo: false, alterado_em: new Date().toISOString() }, { onConflict: 'chamado_id' });
  if (error) throw error;
}

export async function restaurarChamado(chamadoId: string, adminId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from('chamados_arquivados')
    .upsert({ chamado_id: chamadoId, alterado_por: adminId, ativo: true, alterado_em: new Date().toISOString() }, { onConflict: 'chamado_id' });
  if (error) throw error;
}

export async function obterArquivados(): Promise<Set<string>> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('chamados_arquivados').select('chamado_id,ativo');
  if (error) throw error;
  return new Set((data ?? []).filter(item => item.ativo === false).map(item => item.chamado_id));
}
