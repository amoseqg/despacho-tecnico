'use client';

import { useEffect, useMemo, useState } from 'react';
import { baixarRelatorioVistoria, listarRelatoriosVistoria, type RelatorioVistoriaAdmin } from './vistorias.service';

export function VistoriasPanel() {
  const [relatorios, setRelatorios] = useState<RelatorioVistoriaAdmin[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarRelatoriosVistoria()
      .then(setRelatorios)
      .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os relatórios de vistoria.'))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return relatorios;
    return relatorios.filter(r => [r.chamado?.protocolo, r.chamado?.site_nome, r.chamado?.circuito, r.tecnico?.nome, r.nome_original].some(v => String(v ?? '').toLowerCase().includes(termo)));
  }, [relatorios, busca]);

  return (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Administrador</span><h2>Relatórios de Vistorias</h2></div></div>
      <div className="admin-search-row"><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por protocolo, técnico, circuito ou site" /></div>
      {carregando && <p>Carregando relatórios...</p>}
      {erro && <div className="error-box">{erro}</div>}
      {!carregando && !erro && filtrados.length === 0 && <p>Nenhum relatório de vistoria encontrado.</p>}
      <div className="report-grid">
        {filtrados.map(r => (
          <article className="report-card" key={r.id}>
            <div><strong>{r.chamado?.protocolo || 'Protocolo não informado'}</strong><span>{r.chamado?.site_nome || 'Site não informado'}</span></div>
            <span>Técnico: {r.tecnico?.nome || 'Não informado'}</span>
            <span>Circuito: {r.chamado?.circuito || '—'}</span>
            <span>Arquivo: {r.nome_original}</span>
            <button className="button secondary" onClick={() => void baixarRelatorioVistoria(r.caminho, r.nome_original)}>Baixar PDF</button>
          </article>
        ))}
      </div>
    </section>
  );
}
