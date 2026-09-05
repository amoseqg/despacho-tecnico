'use client';

import { FormEvent, useEffect, useState } from 'react';
import { carregarRascunho, salvarRascunho } from './draft-store';
import { ServicePhotos } from './ServicePhotos';
import { concluirServico } from './servico.service';

const causas = ['Infracliente', 'Elétrica cliente', 'Elétrica concessionária', 'Mau uso', 'Vistoria'] as const;

export function ServiceExecution({ chamadoId, tecnicoId, atividadeInicial, onConcluido }: { chamadoId: string; tecnicoId: string; atividadeInicial?: string | null; onConcluido?: () => void }) {
  const [atividade, setAtividade] = useState(atividadeInicial || 'manutencao');
  const [causaRaiz, setCausaRaiz] = useState<(typeof causas)[number] | ''>('');
  const [solucaoTecnica, setSolucaoTecnica] = useState('');
  const [validacao, setValidacao] = useState('');
  const [senha, setSenha] = useState('');
  const [observacao, setObservacao] = useState('');
  const [relatorio, setRelatorio] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarRascunho(chamadoId).then(r => {
      if (!r?.campos) return;
      setAtividade(r.campos.atividade || atividadeInicial || 'manutencao');
      setCausaRaiz((r.campos.causaRaiz as (typeof causas)[number]) || '');
      setSolucaoTecnica(r.campos.solucaoTecnica || '');
      setValidacao(r.campos.validacao || '');
      setSenha(r.campos.senha || '');
      setObservacao(r.campos.observacao || '');
    }).catch(() => undefined);
  }, [chamadoId, atividadeInicial]);

  async function persistirCampos() {
    const existente = await carregarRascunho(chamadoId);
    await salvarRascunho({
      chamadoId,
      campos: { atividade, causaRaiz, solucaoTecnica, validacao, senha, observacao },
      fotos: existente?.fotos ?? [],
      atualizadoEm: new Date().toISOString(),
    });
  }

  async function concluir(event: FormEvent) {
    event.preventDefault();
    if (!causaRaiz || !solucaoTecnica.trim() || !validacao.trim() || !senha.trim()) {
      setMensagem('Erro: preencha Causa raiz, Solução técnica, Validação Vectra/UMTelecom e Senha.');
      return;
    }
    if (atividade === 'vistoria' && !relatorio) {
      setMensagem('Erro: anexe o relatório de vistoria em PDF antes de concluir.');
      return;
    }

    setSalvando(true);
    setMensagem('');
    try {
      await persistirCampos();
      await concluirServico({
        chamadoId,
        tecnicoId,
        atividade,
        causaRaiz,
        solucaoTecnica,
        validacao,
        senha,
        observacao,
        relatorioVistoria: relatorio,
      });
      onConcluido?.();
      setMensagem('Serviço concluído e sincronizado com o Supabase.');
    } catch (e) {
      setMensagem(e instanceof Error ? `Erro: ${e.message}` : 'Não foi possível concluir o serviço.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="execution-form" onSubmit={concluir} onBlur={() => { void persistirCampos(); }}>
      <label>Tipo de atividade
        <select value={atividade} onChange={e => setAtividade(e.target.value)}>
          <option value="instalacao">Instalação</option>
          <option value="alteracao">Alteração</option>
          <option value="mudanca_endereco">Mudança</option>
          <option value="manutencao">Manutenção</option>
          <option value="suporte">Suporte</option>
          <option value="vistoria">Vistoria - R$ 150,00</option>
        </select>
      </label>
      {atividade === 'vistoria' && <p className="helper-text">Vistoria com relatório obrigatório.</p>}

      <ServicePhotos chamadoId={chamadoId} />

      {atividade === 'vistoria' && (
        <label>Relatório de vistoria
          <input type="file" accept="application/pdf" required onChange={e => setRelatorio(e.target.files?.[0] ?? null)} />
        </label>
      )}

      <label>Causa raiz *
        <select required value={causaRaiz} onChange={e => setCausaRaiz(e.target.value as (typeof causas)[number])}>
          <option value="">Selecione...</option>{causas.map(causa => <option key={causa}>{causa}</option>)}
        </select>
      </label>
      <label>Solução técnica *<textarea required value={solucaoTecnica} onChange={e => setSolucaoTecnica(e.target.value)} /></label>
      <label>Validação Vectra/UMTelecom *<input required value={validacao} onChange={e => setValidacao(e.target.value)} /></label>
      <label>Senha *<input required value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" /></label>
      <label>Observação<textarea value={observacao} onChange={e => setObservacao(e.target.value)} /></label>
      <button className="button primary" type="submit" disabled={salvando}>{salvando ? 'Concluindo...' : 'Concluir serviço'}</button>
      {mensagem && <div className={mensagem.startsWith('Erro:') ? 'error-box' : 'success-box'}>{mensagem}</div>}
    </form>
  );
}
