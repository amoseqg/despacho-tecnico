'use client';

import { useEffect, useMemo, useState } from 'react';
import { atualizarStatusSolicitacao, listarMateriais, listarSolicitacoesMaterial, type MaterialResumo, type SolicitacaoMaterialResumo } from './logistica.service';

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function LogisticaPanel() {
  const [materiais, setMateriais] = useState<MaterialResumo[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterialResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

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

  useEffect(() => { void carregar(); }, []);

  const emTramite = useMemo(() => solicitacoes.filter(s => !['entregue', 'cancelado'].includes(s.status)), [solicitacoes]);
  const historico = useMemo(() => solicitacoes.filter(s => ['entregue', 'cancelado'].includes(s.status)), [solicitacoes]);

  const filtradas = useMemo(() => {
    const base = mostrarHistorico ? historico : emTramite;
    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(s => [s.tecnico?.nome, s.chamado?.protocolo, s.chamado?.site_nome, s.material?.nome]
      .some(v => String(v ?? '').toLowerCase().includes(termo)));
  }, [busca, emTramite, historico, mostrarHistorico]);

  async function avancar(s: SolicitacaoMaterialResumo) {
    const proximo = s.status === 'solicitado' ? 'direcionado' : s.status === 'direcionado' ? 'separado' : s.status === 'separado' ? 'entregue' : null;
    if (!proximo) return;
    const qtd = proximo === 'separado' ? s.quantidade_solicitada : proximo === 'entregue' ? (s.quantidade_separada || s.quantidade_solicitada) : undefined;
    try {
      await atualizarStatusSolicitacao(s.id, proximo, qtd);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar o trâmite.');
    }
  }

  function exportarHistorico() {
    const cab = ['Protocolo','Site','Cidade','Técnico','Material','Unidade','Qtd solicitada','Qtd separada','Qtd entregue','Status','Solicitado em','Direcionado em','Separado em','Entregue em','Observação'];
    const linhas = solicitacoes.map(s => [
      s.chamado?.protocolo, s.chamado?.site_nome, s.chamado?.cidade, s.tecnico?.nome, s.material?.nome, s.material?.unidade,
      s.quantidade_solicitada, s.quantidade_separada, s.quantidade_entregue, s.status, s.solicitado_em, s.direcionado_em, s.separado_em, s.entregue_em, s.observacao,
    ]);
    const csv = [cab, ...linhas].map(l => l.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexofield-materiais-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel logistics-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Materiais</span><h2>Logística e estoque</h2></div>
        <div className="logistics-stats"><span>{materiais.length} itens ativos</span><span>{emTramite.length} em trâmite</span><span>{historico.length} no histórico</span></div>
      </div>

      <div className="logistics-toolbar">
        <button type="button" className="tramite-toggle" onClick={() => setExpandido(v => !v)} aria-expanded={expandido}>
          <span>Trâmite de materiais</span><strong>{expandido ? 'Ocultar' : 'Abrir'}</strong>
        </button>
        <button type="button" className="button secondary" onClick={exportarHistorico}>Exportar base de materiais</button>
      </div>

      {expandido && (
        <div className="logistics-body">
          <div className="history-toggle-row">
            <input className="search-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar por técnico, protocolo, site ou material" />
            <button type="button" className="button secondary" onClick={() => setMostrarHistorico(v => !v)}>{mostrarHistorico ? 'Voltar ao trâmite' : 'Ver entregues/histórico'}</button>
          </div>
          {!mostrarHistorico && <p className="helper-text">Itens entregues saem automaticamente desta lista, mas permanecem no histórico e na exportação.</p>}
          {carregando && <p>Carregando logística...</p>}
          {erro && <div className="error-box">{erro}</div>}
          {!carregando && !erro && filtradas.length === 0 && <p>{mostrarHistorico ? 'Nenhum item no histórico.' : 'Nenhuma solicitação em trâmite.'}</p>}
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
                {!mostrarHistorico && ['solicitado','direcionado','separado'].includes(s.status) && (
                  <button type="button" className="button primary" onClick={() => void avancar(s)}>
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
