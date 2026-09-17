'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type EnderecoLogistico = {
  tecnico_id: string;
  cep: string;
  endereco: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  atualizado_em: string;
};

export type RastreamentoMaterial = {
  solicitacao_id: string;
  codigo_rastreamento: string | null;
  transportadora: string;
  status_transporte: string | null;
  previsao_entrega: string | null;
  enviado_em: string | null;
  entregue_em: string | null;
  observacao: string | null;
  atualizado_em: string;
};

export async function listarEnderecosLogisticos(): Promise<EnderecoLogistico[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('tecnico_enderecos_logistica')
    .select('tecnico_id,cep,endereco,numero,complemento,bairro,cidade,uf,atualizado_em');
  if (error) throw error;
  return (data ?? []) as EnderecoLogistico[];
}

export async function salvarEnderecoLogistico(endereco: Omit<EnderecoLogistico, 'atualizado_em'>): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('tecnico_enderecos_logistica').upsert({
    ...endereco,
    atualizado_em: new Date().toISOString(),
    atualizado_por: auth.user?.id ?? null,
  }, { onConflict: 'tecnico_id' });
  if (error) throw error;
}

export async function listarRastreamentos(): Promise<RastreamentoMaterial[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('rastreamentos_material')
    .select('solicitacao_id,codigo_rastreamento,transportadora,status_transporte,previsao_entrega,enviado_em,entregue_em,observacao,atualizado_em');
  if (error) throw error;
  return (data ?? []) as RastreamentoMaterial[];
}

export async function salvarRastreamento(rastreio: Omit<RastreamentoMaterial, 'atualizado_em'>): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('rastreamentos_material').upsert({
    ...rastreio,
    atualizado_em: new Date().toISOString(),
    atualizado_por: auth.user?.id ?? null,
  }, { onConflict: 'solicitacao_id' });
  if (error) throw error;
}
