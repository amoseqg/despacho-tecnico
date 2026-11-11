'use client';

import { useEffect, useMemo, useState } from 'react';
import { baixarCsv, listarDesempenho, listarPagamentos, type DesempenhoLinha, type PagamentoLinha } from './financeiro.service';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinanceiroDesempenhoPanel() {
  const [pagamentos, setPagamentos] = useState<PagamentoLinha[]>([]);
  const [desempenho, setDesempenho] = useState<DesempenhoLinha[]>([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([listarPagamentos(), listarDesempenho()])
      .then(([p, d]) => { setPagamentos(p); setDesempenho(d); })
      .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os relatórios.'));
  }, []);

  const pagamentosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return pagamentos;
    return pagamentos.filter(p => [p.protocolo, p.tecnico_nome, p.regiao, p.atividade].some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [pagamentos, busca]);

  const foraPrazo = desempenho.filter(d => d.indicador_sla && !String(d.indicador_sla).toLowerCase().includes('dentro'));
  const reincidentes = desempenho.filter(d => Number(d.reincidencias ?? 0) > 0);
  const total = pagamentosFiltrados.reduce((s, p) => s + p.valor_total, 0);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Financeiro e qualidade</span><h2>Pagamentos e desempenho técnico</h2></div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => baixarCsv('pagamentos-tecnicos.csv', pagamentosFiltrados as unknown as Record<string, unknown>[])}>Exportar pagamentos</button>
          <button className="button secondary" onClick={() => baixarCsv('tecnicos-fora-do-prazo.csv', foraPrazo as unknown as Record<string, unknown>[])}>Prazo perdido</button>
          <button className="button secondary" onClick={() => baixarCsv('reincidencias-tecnicas.csv', reincidentes as unknown as Record<string, unknown>[])}>Reincidências</button>
        </div>
      </div>

      {erro && <div className="error-box">{erro}</div>}

      <div className="dashboard-grid finance-metrics">
        <article className="metric"><strong>{moeda.format(total)}</strong><span>Total filtrado</span></article>
        <article className="metric"><strong>{pagamentosFiltrados.length}</strong><span>Execuções com pagamento</span></article>
        <article className="metric"><strong>{foraPrazo.length}</strong><span>Chamados fora do prazo</span></article>
        <article className="metric"><strong>{reincidentes.length}</strong><span>Chamados com reincidência</span></article>
      </div>

      <input className="search-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar técnico, protocolo, região ou atividade" />

      <div className="admin-table-wrap finance-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Protocolo</th><th>Técnico</th><th>Região</th><th>Atividade</th><th>KM</th><th>Atividade R$</th><th>Materiais R$</th><th>Total</th></tr></thead>
          <tbody>
            {pagamentosFiltrados.map(p => (
              <tr key={p.execucao_id}>
                <td>{p.protocolo || '—'}</td><td>{p.tecnico_nome}</td><td>{p.regiao || '—'}</td><td>{p.atividade || '—'}</td>
                <td>{p.km_total}</td><td>{moeda.format(p.valor_atividade)}</td><td>{moeda.format(p.valor_materiais)}</td><td><strong>{moeda.format(p.valor_total)}</strong></td>
              </tr>
            ))}
            {!pagamentosFiltrados.length && <tr><td colSpan={8}>Nenhuma execução encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
