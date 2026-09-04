'use client';

import { useEffect, useMemo, useState } from 'react';
import { arquivarChamado, listarChamadosAdmin, obterArquivados, pesquisarTecnicos, restaurarChamado, type ChamadoAdminResumo, type TecnicoResumo } from './admin.service';

export function AdminPanel({ adminId }: { adminId: string }) {
  const [buscaChamado, setBuscaChamado] = useState('');
  const [buscaTecnico, setBuscaTecnico] = useState('');
  const [chamados, setChamados] = useState<ChamadoAdminResumo[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([]);
  const [arquivados, setArquivados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [listaChamados, listaTecnicos, idsArquivados] = await Promise.all([
        listarChamadosAdmin(buscaChamado),
        pesquisarTecnicos(buscaTecnico),
        obterArquivados(),
      ]);
      setChamados(listaChamados);
      setTecnicos(listaTecnicos);
      setArquivados(idsArquivados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o painel administrativo.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  const visiveis = useMemo(() => chamados.filter(c => !arquivados.has(c.id)), [chamados, arquivados]);
  const ocultos = useMemo(() => chamados.filter(c => arquivados.has(c.id)), [chamados, arquivados]);

  async function alternarArquivo(chamado: ChamadoAdminResumo, arquivado: boolean) {
    if (arquivado) await restaurarChamado(chamado.id, adminId);
    else await arquivarChamado(chamado.id, adminId);
    await carregar();
  }

  function exportarCsv() {
    const cab = ['Protocolo','SDM','OS Peconecta','Circuito','Site','Cidade','Atividade','Status','Criado por','Criado em','Concluído em'];
    const linhas = visiveis.map(c => [c.protocolo,c.sdm ?? '',c.os_pe_conectado ?? '',c.circuito,c.site_nome ?? '',c.cidade ?? '',c.atividade_servico ?? '',c.status,c.criado_por ?? '',c.criado_em,c.concluido_em ?? '']);
    const csv = [cab, ...linhas].map(l => l.map(v => `"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexofield-chamados-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-stack">
      <section className="panel">
        <div className="panel-heading admin-heading">
          <div><span className="eyebrow">Administrador</span><h2>Gestão de chamados</h2></div>
          <button className="button secondary" onClick={exportarCsv}>Exportar base</button>
        </div>
        <div className="admin-search-row">
          <input value={buscaChamado} onChange={e => setBuscaChamado(e.target.value)} placeholder="Buscar por protocolo, SDM, circuito ou site" />
          <button className="button primary" onClick={() => void carregar()}>Pesquisar</button>
        </div>
        {erro && <div className="error-box">{erro}</div>}
        {carregando && <p>Carregando...</p>}
        {!carregando && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Protocolo</th><th>Site</th><th>Circuito</th><th>Status</th><th>Ação</th></tr></thead><tbody>{visiveis.map(c => <tr key={c.id}><td>{c.protocolo}</td><td>{c.site_nome || '—'}</td><td>{c.circuito}</td><td>{c.status}</td><td><button className="text-action danger" onClick={() => void alternarArquivo(c, false)}>Ocultar</button></td></tr>)}</tbody></table></div>}
        {ocultos.length > 0 && <details className="archived-block"><summary>Chamados ocultos ({ocultos.length})</summary><div className="admin-table-wrap"><table className="admin-table"><tbody>{ocultos.map(c => <tr key={c.id}><td>{c.protocolo}</td><td>{c.site_nome || '—'}</td><td><button className="text-action" onClick={() => void alternarArquivo(c, true)}>Restaurar</button></td></tr>)}</tbody></table></div></details>}
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Cadastro</span><h2>Técnicos</h2></div></div>
        <div className="admin-search-row">
          <input value={buscaTecnico} onChange={e => setBuscaTecnico(e.target.value)} placeholder="Digite o nome, usuário ou e-mail do técnico" />
          <button className="button primary" onClick={() => void carregar()}>Localizar</button>
        </div>
        <div className="technician-grid">{tecnicos.map(t => <article className="technician-card" key={t.id}><strong>{t.nome}</strong><span>{t.email || t.usuario}</span><span>Região: {t.regiao || 'não informada'}</span><span>Status: {t.ativo ? 'Ativo' : 'Inativo'}</span></article>)}</div>
      </section>
    </section>
  );
}
