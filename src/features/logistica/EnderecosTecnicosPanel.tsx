'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { listarEnderecosLogisticos, salvarEnderecoLogistico, type EnderecoLogistico } from './rastreamento.service';

type Tecnico = { id: string; nome: string; regiao: 'capital' | 'interior' | 'noronha' | null };

export function EnderecosTecnicosPanel() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [enderecos, setEnderecos] = useState<Record<string, EnderecoLogistico>>({});
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.from('perfis').select('id,nome,regiao').eq('tipo','tecnico').eq('ativo',true).in('regiao',['interior','noronha']).order('nome');
      if (error) throw error;
      const end = await listarEnderecosLogisticos();
      setTecnicos((data ?? []) as Tecnico[]);
      setEnderecos(Object.fromEntries(end.map(e => [e.tecnico_id, e])));
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar endereços.'); }
  }
  useEffect(() => { void carregar(); }, []);

  async function salvar(tecnicoId: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    await salvarEnderecoLogistico({
      tecnico_id: tecnicoId,
      cep: String(fd.get('cep') || '').trim(),
      endereco: String(fd.get('endereco') || '').trim(),
      numero: String(fd.get('numero') || '').trim() || null,
      complemento: String(fd.get('complemento') || '').trim() || null,
      bairro: String(fd.get('bairro') || '').trim() || null,
      cidade: String(fd.get('cidade') || '').trim(),
      uf: String(fd.get('uf') || 'PE').trim().toUpperCase(),
    });
    await carregar();
  }

  const lista = tecnicos.filter(t => t.nome.toLowerCase().includes(busca.toLowerCase()));
  return <section className="panel">
    <div className="panel-heading"><div><span className="eyebrow">Cadastro</span><h2>Endereços para envio ao interior</h2></div></div>
    <input className="search-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Localizar técnico" />
    {erro && <div className="error-box">{erro}</div>}
    <div className="address-grid">
      {lista.map(t => { const e = enderecos[t.id]; return <form className="address-card" key={t.id} onSubmit={ev => { ev.preventDefault(); void salvar(t.id, ev.currentTarget); }}>
        <strong>{t.nome}</strong><span>{t.regiao}</span>
        <div className="tracking-grid">
          <input required name="cep" defaultValue={e?.cep ?? ''} placeholder="CEP" />
          <input required name="endereco" defaultValue={e?.endereco ?? ''} placeholder="Endereço" />
          <input name="numero" defaultValue={e?.numero ?? ''} placeholder="Número" />
          <input name="bairro" defaultValue={e?.bairro ?? ''} placeholder="Bairro" />
          <input required name="cidade" defaultValue={e?.cidade ?? ''} placeholder="Cidade" />
          <input required name="uf" defaultValue={e?.uf ?? 'PE'} maxLength={2} placeholder="UF" />
          <input name="complemento" defaultValue={e?.complemento ?? ''} placeholder="Complemento" />
        </div>
        <button className="button primary" type="submit">Salvar endereço</button>
      </form>; })}
    </div>
  </section>;
}
