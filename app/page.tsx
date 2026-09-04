import { modulosNexoField } from '@/src/domain/modules';

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">NexoField 2.0 · Migração controlada</span>
          <h1>Gestão Inteligente de Operações de Campo</h1>
          <p>Nova base em Next.js, React e TypeScript, mantendo Supabase e Vercel.</p>
        </div>
        <div className="version">2.0.0-migration.1</div>
      </header>

      <section className="summary-grid" aria-label="Resumo da migração">
        <article className="metric"><strong>{modulosNexoField.length}</strong><span>Módulos preservados</span></article>
        <article className="metric"><strong>{modulosNexoField.filter(m => m.status === 'em_migracao').length}</strong><span>Em migração</span></article>
        <article className="metric"><strong>3</strong><span>Perfis de acesso</span></article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Mapa funcional</span><h2>Funções que serão mantidas</h2></div>
        </div>
        <div className="module-grid">
          {modulosNexoField.map(modulo => (
            <article className="module" key={modulo.id}>
              <div className="module-top">
                <h3>{modulo.nome}</h3>
                <span className={`status ${modulo.status}`}>{modulo.status === 'mapeado' ? 'Mapeado' : modulo.status === 'migrado' ? 'Migrado' : 'Em migração'}</span>
              </div>
              <p>{modulo.perfis.map(p => p === 'administrador' ? 'Administrador' : p === 'tecnico' ? 'Técnico' : 'Logística').join(' · ')}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="notice">
        <strong>Produção protegida.</strong> A versão 1.1.5 permanece na branch main. Esta interface pertence somente à branch de migração até a conclusão dos testes funcionais.
      </section>
    </main>
  );
}
