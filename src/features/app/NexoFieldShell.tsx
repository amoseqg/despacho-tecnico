'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import type { PerfilDb } from '@/src/features/auth/perfil.service';
import { listarChamados, obterReincidencia, type ChamadoResumo, type ReincidenciaResumo } from '@/src/features/chamados/chamados.service';
import { ServiceExecution } from '@/src/features/servicos/ServiceExecution';
import { LogisticaPanel } from '@/src/features/logistica/LogisticaPanel';
import { RastreamentoInteriorPanel } from '@/src/features/logistica/RastreamentoInteriorPanel';
import { EnderecosTecnicosPanel } from '@/src/features/logistica/EnderecosTecnicosPanel';
import { AdminPanel } from '@/src/features/admin/AdminPanel';
import { VistoriasPanel } from '@/src/features/admin/VistoriasPanel';
import { FotosPanel } from '@/src/features/admin/FotosPanel';
import { TechnicianLocationsPanel } from '@/src/features/admin/TechnicianLocationsPanel';
import { TechnicianTracking } from '@/src/features/chamados/TechnicianTracking';
import { aceitarChamado } from '@/src/features/chamados/tracking.service';
import { DashboardPanel } from '@/src/features/admin/DashboardPanel';
import { FinanceiroDesempenhoPanel } from '@/src/features/admin/FinanceiroDesempenhoPanel';
import { AprovacoesPanel } from '@/src/features/admin/AprovacoesPanel';
import { ThemeSwitcher } from './ThemeSwitcher';
import { NEXOFIELD_VERSION } from '@/src/lib/version';

export function NexoFieldShell({ user, perfil }: { user: User; perfil: PerfilDb }) {
  const [chamados, setChamados] = useState<ChamadoResumo[]>([]);
  const [reincidencias, setReincidencias] = useState<Record<string, ReincidenciaResumo | null>>({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await listarChamados(perfil);
        if (!ativo) return;
        setChamados(lista);
        const primeiros = lista.slice(0, 20);
        const pares = await Promise.all(primeiros.map(async chamado => [chamado.id, await obterReincidencia(chamado.id)] as const));
        if (ativo) setReincidencias(Object.fromEntries(pares));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os chamados.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [perfil]);

  async function sair() {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.reload();
  }

  const tituloPerfil = perfil.tipo === 'admin' ? 'Administrador' : perfil.tipo === 'tecnico' ? 'Técnico' : 'Logística';
  const emAberto = chamados.filter(c => !['concluida', 'cancelado'].includes(c.status)).length;
  const concluidos = chamados.filter(c => c.status === 'concluida').length;
  const reincidentes = Object.values(reincidencias).filter(Boolean).length;

  return (
    <main className="shell">
      <header className="hero compact-hero">
        <div>
          <span className="eyebrow">NexoField 2.0 · ambiente de migração</span>
          <h1>{tituloPerfil}</h1>
          <p>{perfil.nome} · {user.email}</p>
        </div>
        <div className="header-actions"><ThemeSwitcher /><span className="version">{NEXOFIELD_VERSION}</span><button className="button light" onClick={sair}>Sair</button></div>
      </header>

      <section className="summary-grid">
        <article className="metric"><strong>{emAberto}</strong><span>Chamados em aberto</span></article>
        <article className="metric"><strong>{concluidos}</strong><span>Concluídos carregados</span></article>
        <article className="metric"><strong>{reincidentes}</strong><span>Reincidências identificadas</span></article>
      </section>

      {perfil.tipo === 'admin' && <DashboardPanel />}
      {perfil.tipo === 'admin' && <FinanceiroDesempenhoPanel />}
      {perfil.tipo === 'admin' && <AprovacoesPanel adminId={perfil.id} />}
      {perfil.tipo === 'admin' && <AdminPanel adminId={perfil.id} />}
      {perfil.tipo === 'admin' && <VistoriasPanel />}
      {perfil.tipo === 'admin' && <FotosPanel />}
      {perfil.tipo === 'admin' && <TechnicianLocationsPanel />}
      {(perfil.tipo === 'admin' || perfil.tipo === 'logistica') && <LogisticaPanel />}
      {(perfil.tipo === 'admin' || perfil.tipo === 'logistica') && <EnderecosTecnicosPanel />}
      {(perfil.tipo === 'admin' || perfil.tipo === 'logistica') && <RastreamentoInteriorPanel />}

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Base real</span><h2>Chamados do Supabase</h2></div></div>
        {carregando && <p>Carregando chamados...</p>}
        {erro && <div className="error-box">{erro}</div>}
        {!carregando && !erro && chamados.length === 0 && <p>Nenhum chamado disponível para este perfil.</p>}
        <div className="ticket-list">
          {chamados.slice(0, 30).map(chamado => {
            const reincidencia = reincidencias[chamado.id];
            return (
              <article className="ticket" key={chamado.id}>
                <div className="ticket-head">
                  <div><strong>{chamado.protocolo}</strong><span>{chamado.site_nome || 'Site não informado'}</span></div>
                  <span className={`ticket-status st-${chamado.status}`}>{chamado.status}</span>
                </div>
                <div className="ticket-meta"><span>Circuito: {chamado.circuito}</span><span>SDM: {chamado.sdm || '—'}</span><span>{chamado.cidade || 'Cidade não informada'}</span></div>
                <div className="ticket-meta"><span><strong>Motivo do chamado:</strong> {chamado.motivo_chamado || '—'}</span></div>
                {reincidencia && <div className="reincidencia"><strong>Reincidência</strong><span>Último técnico: {reincidencia.tecnico_anterior || 'Não informado'}</span><span>Ação: {reincidencia.acao_realizada || 'Não informada'}</span></div>}
                {perfil.tipo==='tecnico'&&chamado.status==='pendente'&&<button className="button primary" onClick={async()=>{if(!confirm('Ao aceitar, sua localização será solicitada e compartilhada somente durante este atendimento.'))return;try{await aceitarChamado(chamado.id,perfil.id);setChamados(lista=>lista.map(c=>c.id===chamado.id?{...c,status:'andamento'}:c));}catch(e){setErro(e instanceof Error?e.message:'Não foi possível aceitar o chamado.')}}}>Aceitar chamado e iniciar rastreamento</button>}
                {perfil.tipo==='tecnico'&&chamado.status==='andamento'&&<TechnicianTracking chamadoId={chamado.id} tecnicoId={perfil.id} />}
                {perfil.tipo === 'tecnico' && chamado.status === 'andamento' && (
                  <details className="execution-preview">
                    <summary>Executar serviço</summary>
                    <ServiceExecution chamadoId={chamado.id} tecnicoId={perfil.id} atividadeInicial={chamado.atividade_servico} onConcluido={()=>setChamados(lista=>lista.map(c=>c.id===chamado.id?{...c,status:'concluida'}:c))} />
                  </details>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="notice"><strong>Ambiente protegido.</strong> Esta tela usa o banco atual, mas permanece apenas na branch de migração. A produção 1.1.5 não foi substituída.</section>
    </main>
  );
}
