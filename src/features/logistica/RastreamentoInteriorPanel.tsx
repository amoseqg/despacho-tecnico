'use client';

import { useEffect, useMemo, useState } from 'react';
import { listarSolicitacoesMaterial, type SolicitacaoMaterialResumo } from './logistica.service';
import { listarEnderecosLogisticos, listarRastreamentos, salvarRastreamento, type EnderecoLogistico, type RastreamentoMaterial } from './rastreamento.service';

export function RastreamentoInteriorPanel() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterialResumo[]>([]);
  const [enderecos, setEnderecos] = useState<EnderecoLogistico[]>([]);
  const [rastreios, setRastreios] = useState<RastreamentoMaterial[]>([]);
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      const [s,e,r] = await Promise.all([listarSolicitacoesMaterial(), listarEnderecosLogisticos(), listarRastreamentos()]);
      setSolicitacoes(s); setEnderecos(e); setRastreios(r);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar rastreamentos.'); }
  }
  useEffect(() => { void carregar(); }, []);

  const rastreioPorSolicitacao = useMemo(() => new Map(rastreios.map(r => [r.solicitacao_id, r])), [rastreios]);
  const enderecoPorTecnico = useMemo(() => new Map(enderecos.map(e => [e.tecnico_id, e])), [enderecos]);

  async function salvar(s: SolicitacaoMaterialResumo, form: HTMLFormElement) {
    const fd = new FormData(form);
    await salvarRastreamento({
      solicitacao_id: s.id,
      codigo_rastreamento: String(fd.get('codigo') || '') || null,
      transportadora: String(fd.get('transportadora') || 'Correios'),
      status_transporte: String(fd.get('status') || '') || null,
      previsao_entrega: String(fd.get('previsao') || '') || null,
      enviado_em: rastreioPorSolicitacao.get(s.id)?.enviado_em ?? new Date().toISOString(),
      entregue_em: s.status === 'entregue' ? new Date().toISOString() : null,
      observacao: String(fd.get('observacao') || '') || null,
    });
    await carregar();
  }

  return <section className="panel">
    <div className="panel-heading"><div><span className="eyebrow">Interior</span><h2>Rastreamento de materiais</h2></div></div>
    {erro && <div className="error-box">{erro}</div>}
    <div className="material-flow-list">
      {solicitacoes.filter(s => s.chamado?.cidade).map(s => {
        const r = rastreioPorSolicitacao.get(s.id);
        const e = enderecoPorTecnico.get(s.tecnico_id);
        return <form className="material-flow-card" key={s.id} onSubmit={ev => { ev.preventDefault(); void salvar(s, ev.currentTarget); }}>
          <div className="material-flow-head"><div><strong>{s.tecnico?.nome || 'Técnico'}</strong><span>{s.chamado?.protocolo} · {s.chamado?.cidade}</span></div><span className={`ticket-status st-${s.status}`}>{s.status}</span></div>
          <div className="ticket-meta"><span>Destino: {e ? `${e.endereco}${e.numero ? `, ${e.numero}` : ''} · ${e.cidade}/${e.uf} · CEP ${e.cep}` : 'Endereço logístico não cadastrado'}</span></div>
          <div className="tracking-grid">
            <input name="codigo" defaultValue={r?.codigo_rastreamento ?? ''} placeholder="Código de rastreamento" />
            <input name="transportadora" defaultValue={r?.transportadora ?? 'Correios'} placeholder="Transportadora" />
            <input name="status" defaultValue={r?.status_transporte ?? ''} placeholder="Status do transporte" />
            <input name="previsao" type="date" defaultValue={r?.previsao_entrega ?? ''} />
            <input name="observacao" defaultValue={r?.observacao ?? ''} placeholder="Observação" />
          </div>
          <button className="button primary" type="submit">Salvar rastreamento</button>
        </form>;
      })}
    </div>
  </section>;
}
