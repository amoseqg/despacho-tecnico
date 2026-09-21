'use client';

import { useEffect, useState } from 'react';
import { carregarDashboardResumo, type DashboardResumo } from './dashboard.service';

export function DashboardPanel() {
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarDashboardResumo().then(setDados).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.'));
  }, []);

  return (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Administrador</span><h2>Dashboard operacional</h2></div></div>
      {erro && <div className="error-box">{erro}</div>}
      {!dados && !erro && <p>Carregando indicadores...</p>}
      {dados && <div className="dashboard-grid">
        <article className="metric"><strong>{dados.total}</strong><span>Total de chamados</span></article>
        <article className="metric"><strong>{dados.abertos}</strong><span>Abertos</span></article>
        <article className="metric"><strong>{dados.andamento}</strong><span>Em andamento</span></article>
        <article className="metric"><strong>{dados.pendentes}</strong><span>Pendentes</span></article>
        <article className="metric"><strong>{dados.concluidos}</strong><span>Concluídos</span></article>
        <article className="metric"><strong>{dados.reincidencias}</strong><span>Reincidências</span></article>
        <article className="metric"><strong>{dados.foraSla}</strong><span>Fora do SLA</span></article>
        <article className="metric"><strong>{dados.cancelados}</strong><span>Cancelados</span></article>
      </div>}
    </section>
  );
}
