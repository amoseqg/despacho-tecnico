'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { carregarRascunho, limparRascunho } from './draft-store';

export type EncerramentoInput = {
  chamadoId: string;
  tecnicoId: string;
  atividade: string;
  causaRaiz: 'Infracliente' | 'Elétrica cliente' | 'Elétrica concessionária' | 'Mau uso' | 'Vistoria';
  solucaoTecnica: string;
  validacao: string;
  senha: string;
  observacao: string;
  relatorioVistoria?: File | null;
};

function nomeSeguro(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function objetoJaExiste(message: string) {
  const texto = message.toLowerCase();
  return texto.includes('already exists') || texto.includes('duplicate');
}

export async function concluirServico(input: EncerramentoInput) {
  if (!input.causaRaiz || !input.solucaoTecnica.trim() || !input.validacao.trim() || !input.senha.trim()) {
    throw new Error('Campos obrigatórios de encerramento não preenchidos.');
  }
  if (input.atividade === 'vistoria' && !input.relatorioVistoria) {
    throw new Error('Relatório de vistoria obrigatório.');
  }

  const supabase = createSupabaseBrowserClient();
  const rascunho = await carregarRascunho(input.chamadoId);

  for (const foto of rascunho?.fotos ?? []) {
    const caminho = `${input.tecnicoId}/${input.chamadoId}/${foto.id}-${nomeSeguro(foto.nome)}`;
    const { error: uploadError } = await supabase.storage.from('fotos-atividades').upload(caminho, foto.arquivo, {
      contentType: foto.tipo,
      upsert: false,
    });
    if (uploadError && !objetoJaExiste(uploadError.message)) throw uploadError;

    const { error: registroError } = await supabase.from('fotos_atividade').insert({
      chamado_id: input.chamadoId,
      tecnico_id: input.tecnicoId,
      caminho,
      nome_original: foto.nome,
      tamanho_bytes: foto.arquivo.size,
      tipo_mime: foto.tipo,
    });
    if (registroError && registroError.code !== '23505') throw registroError;
  }

  if (input.relatorioVistoria) {
    const arquivo = input.relatorioVistoria;
    const caminho = `${input.tecnicoId}/${input.chamadoId}/relatorio-${nomeSeguro(arquivo.name || 'relatorio-vistoria.pdf')}`;
    const { error: uploadError } = await supabase.storage.from('relatorios-vistoria').upload(caminho, arquivo, {
      contentType: arquivo.type || 'application/pdf',
      upsert: false,
    });
    if (uploadError && !objetoJaExiste(uploadError.message)) throw uploadError;

    const { error: registroError } = await supabase.from('relatorios_vistoria').upsert({
      chamado_id: input.chamadoId,
      tecnico_id: input.tecnicoId,
      caminho,
      nome_original: arquivo.name || 'relatorio-vistoria.pdf',
      tamanho_bytes: arquivo.size,
      tipo_mime: arquivo.type || 'application/pdf',
    }, { onConflict: 'caminho' });
    if (registroError) throw registroError;
  }

  const relatorioEncerramento = [
    `CAUSA RAIZ: ${input.causaRaiz}`,
    `SOLUÇÃO TÉCNICA: ${input.solucaoTecnica}`,
    `VALIDAÇÃO VECTRA/UMTELECOM: ${input.validacao}`,
    `SENHA: ${input.senha}`,
    input.observacao ? `OBSERVAÇÃO: ${input.observacao}` : '',
  ].filter(Boolean).join('\n');

  const valorAtividade = input.atividade.toLowerCase() === 'vistoria' ? 150 : 0;
  const { error: execucaoError } = await supabase.from('execucoes').upsert({
    chamado_id: input.chamadoId,
    tecnico_id: input.tecnicoId,
    atividade: input.atividade,
    observacao: input.observacao || null,
    relatorio_encerramento: relatorioEncerramento,
    valor_atividade: valorAtividade,
    valor_total: valorAtividade,
  }, { onConflict: 'chamado_id' });
  if (execucaoError) throw execucaoError;

  const { data: chamadoAtualizado, error: chamadoError } = await supabase.from('chamados').update({
    status: 'concluida',
    concluido_em: new Date().toISOString(),
  }).eq('id', input.chamadoId).eq('tecnico_id', input.tecnicoId).select('id').maybeSingle();
  if (chamadoError) throw chamadoError;
  if (!chamadoAtualizado) throw new Error('O chamado não foi atualizado. Confirme se ele ainda está atribuído a este técnico.');

  await limparRascunho(input.chamadoId);
}
