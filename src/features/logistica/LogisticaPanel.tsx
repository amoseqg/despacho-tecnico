'use client';

import { useEffect, useMemo, useState } from 'react';
import { atualizarStatusSolicitacao, listarMateriais, listarSolicitacoesMaterial, type MaterialResumo, type SolicitacaoMaterialResumo } from './logistica.service';

export function LogisticaPanel() {
  const [materiais, setMateriais] = useState<MaterialResumo[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterialResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [mats, sols] = await Promise.all([listarMateriais(), listarSolicitacoesMaterial()]);
      setMateriais(mats);
      setSolicitacoes(sols);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a logística.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return solicitacoes;
    return solicitacoes.filter(s => [s.tecnico?.nome, s.chamado?.protocolo, s.chamado?.site_nome, s.material?.nome]
      .some(v => String(v ?? '').toLowerCase().includes(termo)));
  }, [busca, solicitacoes]);

  async function avancar(s: SolicitacaoMaterialResumo) {
    const proximo = s.status === 'solicitado' ? 'direcionado' : s.status === 'direcionado' ? 'separado' : s.status === 'separado' ? 'entregue' : null;
    if (!proximo) return;
    const qtd = proximo === 'separado' ? s.quantidade_solicitada : proximo === 'entregue' ? (s.quantidade_separada || s.quantidade_solicitada) : undefined;
    await atualizarStatusSolicitacao(s.id, proximo, qtd);
    await carregar();
  }

  return (
    <section className="panel logistics-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Materiais</span><h2>Logística e estoque</h2></div>
        <div className="logistics-stats"><span>{materiais.length} itens ativos</span><span>{solicitacoes.filter(s => s.status !== 'entregue' && s.status !== 'cancelado').length} em trâmite</span></div>
      </div>

      <button type="button" className="tramite-toggle" onClick={() => setExpandido(v => !v)} aria-expanded={expandido}>
        <span>Trâmite de materiais</span><strong>{expandido ? 'Ocultar' : 'Abrir'}</strong>
      </button>

      {expandido && (
        <div className="logistics-body">
          <input className="search-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar por técnico, protocolo, site ou material" />
          {carregando && <p>Carregando logística...</p>}
          {erro && <div className="error-box">{erro}</div>}
          {!carregando && !erro && filtradas.length === 0 && <p>Nenhuma solicitação encontrada.</p>}
          <div className="material-flow-list">
            {filtradas.map(s => (
              <article className="material-flow-card" key={s.id}>
                <div className="material-flow-head">
                  <div><strong>{s.material?.nome ?? 'Material'}</strong><span>{s.chamado?.protocolo ?? 'Sem protocolo'} · {s.tecnico?.nome ?? 'Técnico não informado'}</span></div>
                  <span className={`ticket-status st-${s.status}`}>{s.status}</span>
                </div>
                <div className="ticket-meta">
                  <span>Solicitado: {s.quantidade_solicitada} {s.material?.unidade ?? ''}</span>
                  <span>Separado: {s.quantidade_separada}</span>
                  <span>Entregue: {s.quantidade_entregue}</span>
                  <span>{s.chamado?.cidade ?? 'Cidade não informada'}</span>
                </div>
                {['solicitado','direcionado','separado'].includes(s.status) && (
                  <button type="button" className="button primary" onClick={() => avancar(s)}>
                    {s.status === 'solicitado' ? 'Direcionar para separação' : s.status === 'direcionado' ? 'Marcar como separado' : 'Marcar como entregue'}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
