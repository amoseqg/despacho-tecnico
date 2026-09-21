'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type RelatorioVistoriaAdmin = {
  id: string;
  chamado_id: string;
  tecnico_id: string;
  caminho: string;
  nome_original: string;
  tamanho_bytes: number;
  tipo_mime: string;
  criado_em: string;
  chamado?: { protocolo?: string | null; site_nome?: string | null; circuito?: string | null } | null;
  tecnico?: { nome?: string | null } | null;
};

export async function listarRelatoriosVistoria(): Promise<RelatorioVistoriaAdmin[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('relatorios_vistoria')
    .select('id,chamado_id,tecnico_id,caminho,nome_original,tamanho_bytes,tipo_mime,criado_em,chamado:chamados(protocolo,site_nome,circuito),tecnico:perfis(nome)')
    .order('criado_em', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as RelatorioVistoriaAdmin[];
}

export async function baixarRelatorioVistoria(caminho: string, nome: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage.from('relatorios-vistoria').download(caminho);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome || 'relatorio-vistoria.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
