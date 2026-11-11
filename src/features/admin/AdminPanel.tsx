'use client';

import { useEffect, useMemo, useState } from 'react';
import { arquivarChamado, listarChamadosAdmin, obterArquivados, pesquisarTecnicos, restaurarChamado, type ChamadoAdminResumo, type TecnicoResumo } from './admin.service';
import { ChamadoEditor } from './ChamadoEditor';

export function AdminPanel({ adminId }: { adminId: string }) {
  const [buscaChamado, setBuscaChamado] = useState('');
  const [buscaTecnico, setBuscaTecnico] = useState('');
  const [buscaArquivados, setBuscaArquivados] = useState('');
  const [chamados, setChamados] = useState<ChamadoAdminResumo[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([]);
  const [pesquisouTecnico, setPesquisouTecnico] = useState(false);
  const [editando, setEditando] = useState<ChamadoAdminResumo | null>(null);
  const [arquivados, setArquivados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregarChamados() {
    const [listaChamados, idsArquivados] = await Promise.all([listarChamadosAdmin(buscaChamado), obterArquivados()]);
    setChamados(listaChamados);
    setArquivados(idsArquivados);
  }

  async function carregar() {
    setCarregando(true);
    setErro('');
    try { await carregarChamados(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar o painel administrativo.'); }
    finally { setCarregando(false); }
  }

  useEffect(() => { void carregar(); }, []);

  const visiveis = useMemo(() => chamados.filter(c => !arquivados.has(c.id)), [chamados, arquivados]);
  const ocultos = useMemo(() => chamados.filter(c => arquivados.has(c.id)), [chamados, arquivados]);
  const ocultosFiltrados = useMemo(() => {
    const termo=buscaArquivados.trim().toLowerCase();
    if(!termo)return [];
    return ocultos.filter(c=>[c.protocolo,c.site_nome,c.circuito,c.tecnico_id].some(v=>String(v??'').toLowerCase().includes(termo)));
  },[ocultos,buscaArquivados]);

  async function localizarTecnico() {
    setErro(''); setPesquisouTecnico(true);
    try {
      const termo = buscaTecnico.trim();
      setTecnicos(termo ? await pesquisarTecnicos(termo) : []);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível localizar o técnico.'); }
  }

  async function alternarArquivo(chamado: ChamadoAdminResumo, arquivado: boolean) {
    try {
      if (arquivado) await restaurarChamado(chamado.id, adminId);
      else await arquivarChamado(chamado.id, adminId);
      await carregarChamados();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível alterar a visibilidade do chamado.'); }
  }

  function exportarCsv() {
    const cab = ['Protocolo','SDM','OS Peconecta','Circuito','Site','Cidade','Atividade','Status','Aberto por','ID abertura','Criado em','Concluído em'];
    const linhas = visiveis.map(c => [c.protocolo,c.sdm ?? '',c.os_pe_conectado ?? '',c.circuito,c.site_nome ?? '',c.cidade ?? '',c.atividade_servico ?? '',c.status,c.criado_por_nome ?? '',c.criado_por ?? '',c.criado_em,c.concluido_em ?? '']);
    const csv = [cab, ...linhas].map(l => l.map(v => `"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexofield-chamados-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarArquivados() {
    const cab=['Protocolo','SDM','Circuito','Site','Cidade','Status','Técnico ID','Criado em','Concluído em'];
    const linhas=ocultos.map(c=>[c.protocolo,c.sdm??'',c.circuito,c.site_nome??'',c.cidade??'',c.status,c.tecnico_id??'',c.criado_em,c.concluido_em??'']);
    if(!linhas.length)return;
    const csv=[cab,...linhas].map(l=>l.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
    const url=URL.createObjectURL(new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`nexofield-chamados-excluidos-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-stack">
      <section className="panel"><ChamadoEditor adminId={adminId} chamado={editando} onCancelar={() => setEditando(null)} onSalvo={async () => { setEditando(null); await carregarChamados(); }} /></section>

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
        {!carregando && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Protocolo</th><th>Site</th><th>Circuito</th><th>Status</th><th>Aberto por</th><th>Ações</th></tr></thead><tbody>{visiveis.map(c => <tr key={c.id}><td>{c.protocolo}</td><td>{c.site_nome || '—'}</td><td>{c.circuito}</td><td>{c.status}</td><td>{c.criado_por_nome || '—'}</td><td><div className="table-actions"><button className="text-action" onClick={() => setEditando(c)}>Editar</button><button className="text-action danger" onClick={() => void alternarArquivo(c, false)}>Ocultar</button></div></td></tr>)}</tbody></table></div>}
        <div className="archived-block"><div className="panel-heading"><h3>Chamados excluídos da lista</h3><button className="button secondary" disabled={!ocultos.length} onClick={exportarArquivados}>Exportar excluídos</button></div><div className="admin-search-row"><input value={buscaArquivados} onChange={e=>setBuscaArquivados(e.target.value)} placeholder="Buscar por chamado, site ou técnico" /></div>{!buscaArquivados.trim()&&<p className="helper-text">A lista permanece oculta até uma busca.</p>}{buscaArquivados.trim()&&<div className="admin-table-wrap"><table className="admin-table"><tbody>{ocultosFiltrados.map(c => <tr key={c.id}><td>{c.protocolo}</td><td>{c.site_nome || '—'}</td><td><button className="text-action" onClick={() => void alternarArquivo(c, true)}>Restaurar</button></td></tr>)}</tbody></table></div>}</div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Cadastro</span><h2>Técnicos</h2></div></div>
        <div className="admin-search-row">
          <input value={buscaTecnico} onChange={e => { setBuscaTecnico(e.target.value); setPesquisouTecnico(false); setTecnicos([]); }} onKeyDown={e => { if (e.key === 'Enter') void localizarTecnico(); }} placeholder="Digite o nome, usuário ou e-mail do técnico" />
          <button className="button primary" onClick={() => void localizarTecnico()}>Localizar</button>
        </div>
        {!pesquisouTecnico && <p className="helper-text">A lista permanece oculta. Digite um técnico para consultar o cadastro.</p>}
        {pesquisouTecnico && tecnicos.length === 0 && <p>Nenhum técnico encontrado.</p>}
        {pesquisouTecnico && <div className="technician-grid">{tecnicos.map(t => <article className="technician-card" key={t.id}><strong>{t.nome}</strong><span>{t.email || t.usuario}</span><span>Região: {t.regiao || 'não informada'}</span><span>Status: {t.ativo ? 'Ativo' : 'Inativo'}</span></article>)}</div>}
      </section>
    </section>
  );
}
