'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import type { PerfilDb } from '@/src/features/auth/perfil.service';
import { listarChamados, obterReincidencia, type ChamadoResumo, type ReincidenciaResumo } from '@/src/features/chamados/chamados.service';
import { ServicePhotos } from '@/src/features/servicos/ServicePhotos';

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
        <div className="header-actions"><span className="version">2.0.0-migration.1</span><button className="button light" onClick={sair}>Sair</button></div>
      </header>

      <section className="summary-grid">
        <article className="metric"><strong>{emAberto}</strong><span>Chamados em aberto</span></article>
        <article className="metric"><strong>{concluidos}</strong><span>Concluídos carregados</span></article>
        <article className="metric"><strong>{reincidentes}</strong><span>Reincidências identificadas</span></article>
      </section>

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
                {reincidencia && <div className="reincidencia"><strong>Reincidência</strong><span>Último técnico: {reincidencia.tecnico_anterior || 'Não informado'}</span><span>Ação: {reincidencia.acao_realizada || 'Não informada'}</span></div>}
                {perfil.tipo === 'tecnico' && chamado.status !== 'concluida' && (
                  <details className="execution-preview">
                    <summary>Executar serviço</summary>
                    <ServicePhotos chamadoId={chamado.id} />
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
