'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { listarCidadesPe, pesquisarTecnicos, salvarChamadoAdmin, type ChamadoAdminResumo, type ChamadoEditorInput, type TecnicoResumo } from './admin.service';

type Props = {
  adminId: string;
  chamado?: ChamadoAdminResumo | null;
  onSalvo: () => Promise<void> | void;
  onCancelar?: () => void;
};

const vazio: ChamadoEditorInput = {
  protocolo: '', sdm: '', os_pe_conectado: '', circuito: '', site_nome: '', cidade: '', endereco: '', contato: '', descricao: '',
  tipo_os: 'manutencao', atividade_servico: null, regiao: 'capital', area: '', skill: 'voz', tecnico_id: null,
};

function normalizarRotulo(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extrairPorRotulos(texto: string, rotulos: string[]) {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const linha of linhas) {
    const normal = normalizarRotulo(linha);
    for (const rotulo of rotulos) {
      const r = normalizarRotulo(rotulo);
      if (normal.startsWith(r + ' ') || normal === r) {
        const pos = linha.search(/[:\-]/);
        if (pos >= 0) return linha.slice(pos + 1).trim();
        const partes = linha.split(/\s+/);
        return partes.slice(r.split(' ').length).join(' ').trim();
      }
    }
  }
  return '';
}

function parseDescricao(texto: string): Partial<ChamadoEditorInput> {
  const protocolo = extrairPorRotulos(texto, ['protocolo metodo', 'numero metodo', 'n metodo', 'metodo']);
  const sdm = extrairPorRotulos(texto, ['sdm']);
  const os = extrairPorRotulos(texto, ['os pe conectado', 'os peconecta', 'numero os', 'n os']);
  const circuito = extrairPorRotulos(texto, ['circuito', 'designacao', 'designação']);
  const site = extrairPorRotulos(texto, ['site cliente', 'site', 'cliente']);
  const endereco = extrairPorRotulos(texto, ['endereco', 'endereço']);
  const cidade = extrairPorRotulos(texto, ['cidade', 'municipio', 'município']);
  const contato = extrairPorRotulos(texto, ['contato', 'telefone']);
  return {
    ...(protocolo && { protocolo: protocolo.replace(/\D/g, '') }),
    ...(sdm && { sdm }), ...(os && { os_pe_conectado: os }), ...(circuito && { circuito }),
    ...(site && { site_nome: site }), ...(endereco && { endereco }), ...(cidade && { cidade }), ...(contato && { contato }),
  };
}

export function ChamadoEditor({ adminId, chamado, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState<ChamadoEditorInput>(vazio);
  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [buscaCidade, setBuscaCidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void Promise.all([pesquisarTecnicos(''), listarCidadesPe()]).then(([t, c]) => { setTecnicos(t); setCidades(c); }).catch(e => setMensagem(`Erro: ${e instanceof Error ? e.message : 'falha ao carregar opções'}`));
  }, []);

  useEffect(() => {
    if (!chamado) { setForm(vazio); return; }
    setForm({
      id: chamado.id, protocolo: chamado.protocolo || '', sdm: chamado.sdm || '', os_pe_conectado: chamado.os_pe_conectado || '',
      circuito: chamado.circuito || '', site_nome: chamado.site_nome || '', cidade: chamado.cidade || '', endereco: chamado.endereco || '', contato: chamado.contato || '',
      descricao: chamado.descricao || '', tipo_os: chamado.tipo_os || 'manutencao', atividade_servico: (chamado.atividade_servico as ChamadoEditorInput['atividade_servico']) || null,
      regiao: chamado.regiao || 'capital', area: chamado.area || '', skill: (chamado.skill as ChamadoEditorInput['skill']) || 'voz', tecnico_id: chamado.tecnico_id || null,
    });
  }, [chamado]);

  const tecnicosElegiveis = useMemo(() => tecnicos.filter(t => {
    if (t.regiao !== form.regiao) return false;
    if (t.skills?.length && !t.skills.includes(form.skill)) return false;
    if (form.regiao === 'capital' && form.area && t.areas?.length && !t.areas.includes(form.area.toLowerCase())) return false;
    return true;
  }), [tecnicos, form.regiao, form.skill, form.area]);

  const cidadesFiltradas = useMemo(() => {
    const termo = normalizarRotulo(buscaCidade || form.cidade || '');
    if (!termo) return cidades.slice(0, 30);
    return cidades.filter(c => normalizarRotulo(c).includes(termo)).slice(0, 30);
  }, [cidades, buscaCidade, form.cidade]);

  function campo<K extends keyof ChamadoEditorInput>(chave: K, valor: ChamadoEditorInput[K]) {
    setForm(f => ({ ...f, [chave]: valor }));
  }

  function interpretarDescricao() {
    if (!form.descricao?.trim()) return;
    const extraidos = parseDescricao(form.descricao);
    setForm(f => ({ ...f, ...Object.fromEntries(Object.entries(extraidos).filter(([, v]) => Boolean(v))) }));
    setMensagem('Campos identificados na descrição foram preenchidos. Revise antes de salvar.');
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setSalvando(true); setMensagem('');
    try {
      await salvarChamadoAdmin(form, adminId);
      setMensagem(chamado ? 'Chamado atualizado.' : 'Chamado criado e mantido em Chamados em aberto.');
      if (!chamado) setForm(vazio);
      await onSalvo();
    } catch (err) {
      setMensagem(`Erro: ${err instanceof Error ? err.message : 'não foi possível salvar o chamado'}`);
    } finally { setSalvando(false); }
  }

  return (
    <form className="call-editor" onSubmit={salvar}>
      <div className="panel-heading"><div><span className="eyebrow">Administrador</span><h2>{chamado ? 'Editar chamado' : 'Novo chamado'}</h2></div>{chamado && onCancelar && <button type="button" className="button secondary" onClick={onCancelar}>Cancelar edição</button>}</div>
      <label className="editor-full">Descrição do chamado
        <textarea rows={5} value={form.descricao || ''} onChange={e => {
          const descricao = e.target.value;
          setForm(f => ({ ...f, descricao }));
        }} onPaste={e => {
          const extraidos = parseDescricao(e.clipboardData.getData('text'));
          setForm(f => ({ ...f, ...Object.fromEntries(Object.entries(extraidos).filter(([, v]) => Boolean(v))) }));
        }} placeholder="Cole a descrição recebida para preencher os campos automaticamente" />
        <button type="button" className="button secondary inline-button" onClick={interpretarDescricao}>Preencher pela descrição</button>
      </label>
      <div className="editor-grid">
        <label>Protocolo Método *<input inputMode="numeric" pattern="[0-9]+" required value={form.protocolo} onChange={e => campo('protocolo', e.target.value.replace(/\D/g, ''))} /></label>
        <label>SDM<input value={form.sdm || ''} onChange={e => campo('sdm', e.target.value)} /></label>
        <label>Nº OS Peconecta<input value={form.os_pe_conectado || ''} onChange={e => campo('os_pe_conectado', e.target.value)} /></label>
        <label>Circuito *<input required value={form.circuito} onChange={e => campo('circuito', e.target.value)} /></label>
        <label>Site / Cliente<input value={form.site_nome || ''} onChange={e => campo('site_nome', e.target.value)} /></label>
        <label>Endereço<input value={form.endereco || ''} onChange={e => campo('endereco', e.target.value)} /></label>
        <label className="city-picker">Cidade
          <input value={form.cidade || ''} onFocus={e => setBuscaCidade(e.target.value)} onChange={e => { campo('cidade', e.target.value); setBuscaCidade(e.target.value); }} />
          {(buscaCidade || form.cidade) && cidadesFiltradas.length > 0 && <div className="city-results">{cidadesFiltradas.map(c => <button key={c} type="button" onClick={() => { campo('cidade', c); setBuscaCidade(''); }}>{c}</button>)}</div>}
        </label>
        <label>Contato<input value={form.contato || ''} onChange={e => campo('contato', e.target.value)} /></label>
        <label>Tipo de OS<select value={form.tipo_os} onChange={e => campo('tipo_os', e.target.value as ChamadoEditorInput['tipo_os'])}><option value="manutencao">Manutenção</option><option value="servico">Serviço</option></select></label>
        {form.tipo_os === 'servico' && <label>Atividade *<select required value={form.atividade_servico || ''} onChange={e => campo('atividade_servico', e.target.value as ChamadoEditorInput['atividade_servico'])}><option value="">Selecione</option><option value="instalacao">Instalação</option><option value="alteracao">Alteração</option><option value="mudanca_endereco">Mudança de endereço</option><option value="vistoria">Vistoria - R$ 150,00</option></select></label>}
        <label>Região<select value={form.regiao} onChange={e => { const r = e.target.value as ChamadoEditorInput['regiao']; setForm(f => ({ ...f, regiao: r, area: r === 'capital' ? '' : r, tecnico_id: null })); }}><option value="capital">Capital</option><option value="interior">Interior</option><option value="noronha">Fernando de Noronha</option></select></label>
        {form.regiao === 'capital' && <label>Área *<select required value={form.area || ''} onChange={e => { campo('area', e.target.value); campo('tecnico_id', null); }}><option value="">Selecione</option><option value="norte">Norte</option><option value="leste">Leste</option><option value="sul">Sul</option><option value="oeste">Oeste</option></select></label>}
        <label>Skill<select value={form.skill} onChange={e => { campo('skill', e.target.value as ChamadoEditorInput['skill']); campo('tecnico_id', null); }}><option value="voz">Voz</option><option value="dados">Dados</option><option value="infra">Infra</option></select></label>
        <label>Técnico<select value={form.tecnico_id || ''} onChange={e => campo('tecnico_id', e.target.value || null)}><option value="">Selecione o técnico</option>{tecnicosElegiveis.map(t => <option value={t.id} key={t.id}>{t.nome}</option>)}</select></label>
      </div>
      {mensagem && <div className={mensagem.startsWith('Erro:') ? 'error-box' : 'success-box'}>{mensagem}</div>}
      <button className="button primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : chamado ? 'Salvar alterações' : 'Criar chamado'}</button>
    </form>
  );
}
