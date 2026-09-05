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
  endereco?: string | null;
  contato?: string | null;
  descricao?: string | null;
  motivo_chamado?: string | null;
  tipo_os?: 'manutencao' | 'servico';
  atividade_servico: string | null;
  regiao?: 'capital' | 'interior' | 'noronha';
  area?: string | null;
  skill?: string;
  status: string;
  tecnico_id: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  concluido_em: string | null;
};

export type ChamadoEditorInput = {
  id?: string;
  protocolo: string;
  sdm?: string | null;
  os_pe_conectado?: string | null;
  circuito: string;
  site_nome?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  contato?: string | null;
  descricao?: string | null;
  motivo_chamado?: string | null;
  tipo_os: 'manutencao' | 'servico';
  atividade_servico?: 'instalacao' | 'alteracao' | 'mudanca_endereco' | 'vistoria' | null;
  regiao: 'capital' | 'interior' | 'noronha';
  area?: string | null;
  skill: 'voz' | 'dados' | 'infra';
  tecnico_id?: string | null;
};

export async function pesquisarTecnicos(termo: string): Promise<TecnicoResumo[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from('perfis')
    .select('id,nome,email,usuario,regiao,skills,areas,ativo')
    .eq('tipo', 'tecnico')
    .eq('ativo', true)
    .order('nome');

  const busca = termo.trim();
  if (busca) query = query.or(`nome.ilike.%${busca}%,usuario.ilike.%${busca}%,email.ilike.%${busca}%`);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data ?? []) as TecnicoResumo[];
}

export async function listarCidadesPe(): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('escolas').select('municipio').eq('ativo', true).limit(2000);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map(r => String(r.municipio || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function listarChamadosAdmin(termo = ''): Promise<ChamadoAdminResumo[]> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from('chamados')
    .select('id,protocolo,sdm,os_pe_conectado,circuito,site_nome,cidade,endereco,contato,descricao,motivo_chamado,tipo_os,atividade_servico,regiao,area,skill,status,tecnico_id,criado_por,criado_em,concluido_em,aberto_por:perfis!chamados_criado_por_fkey(nome)')
    .order('criado_em', { ascending: false });

  const busca = termo.trim();
  if (busca) query = query.or(`protocolo.ilike.%${busca}%,sdm.ilike.%${busca}%,circuito.ilike.%${busca}%,site_nome.ilike.%${busca}%`);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    protocolo: row.protocolo,
    sdm: row.sdm,
    os_pe_conectado: row.os_pe_conectado,
    circuito: row.circuito,
    site_nome: row.site_nome,
    cidade: row.cidade,
    endereco: row.endereco,
    contato: row.contato,
    descricao: row.descricao,
    motivo_chamado: row.motivo_chamado,
    tipo_os: row.tipo_os,
    atividade_servico: row.atividade_servico,
    regiao: row.regiao,
    area: row.area,
    skill: row.skill,
    status: row.status,
    tecnico_id: row.tecnico_id,
    criado_por: row.criado_por,
    criado_por_nome: row.aberto_por?.nome ?? null,
    criado_em: row.criado_em,
    concluido_em: row.concluido_em,
  }));
}

function payloadChamado(input: ChamadoEditorInput) {
  if (!input.protocolo.trim() || !/^\d+$/.test(input.protocolo.trim())) throw new Error('Protocolo Método deve conter apenas números.');
  if (!input.circuito.trim()) throw new Error('Informe o número do circuito.');
  if (input.regiao === 'capital' && !input.area?.trim()) throw new Error('Informe a área para chamados da capital.');
  if (input.tipo_os === 'servico' && !input.atividade_servico) throw new Error('Selecione o tipo de atividade do serviço.');

  return {
    protocolo: input.protocolo.trim(),
    sdm: input.sdm?.trim() || null,
    os_pe_conectado: input.os_pe_conectado?.trim() || null,
    circuito: input.circuito.trim(),
    site_nome: input.site_nome?.trim() || null,
    cidade: input.cidade?.trim() || null,
    endereco: input.endereco?.trim() || null,
    contato: input.contato?.trim() || null,
    motivo_chamado: input.motivo_chamado?.trim() || null,
    descricao: input.descricao?.trim() || null,
    tipo_os: input.tipo_os,
    atividade_servico: input.tipo_os === 'servico' ? input.atividade_servico ?? null : null,
    regiao: input.regiao,
    area: input.regiao === 'capital' ? input.area?.trim().toLowerCase() || null : input.regiao,
    skill: input.skill,
    tecnico_id: input.tecnico_id || null,
  };
}

export async function salvarChamadoAdmin(input: ChamadoEditorInput, adminId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const payload = payloadChamado(input);

  if (input.id) {
    const { data, error } = await supabase.from('chamados').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', input.id).select('id').single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase.from('chamados').insert({
    ...payload,
    criado_por: adminId,
    status: 'pendente',
    abertura_origem: 'administrador',
  }).select('id').single();
  if (error) throw error;
  return data.id;
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
