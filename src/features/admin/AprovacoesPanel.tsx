'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

type Aprovacao = { id:string; chamado_id:string; status:'pendente'|'aprovado'|'rejeitado'; observacao:string|null; atualizado_em:string; chamado:{protocolo:string;site_nome:string|null;pvf_total:number|null}|null };

export function AprovacoesPanel({ adminId }: { adminId: string }) {
  const [itens,setItens]=useState<Aprovacao[]>([]); const [erro,setErro]=useState('');
  async function carregar(){ try { const s=createSupabaseBrowserClient(); const {data,error}=await s.from('aprovacoes').select('id,chamado_id,status,observacao,atualizado_em,chamado:chamados(protocolo,site_nome,pvf_total)').order('atualizado_em',{ascending:false}); if(error) throw error; setItens((data??[]) as unknown as Aprovacao[]);} catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar aprovações.');}}
  useEffect(()=>{void carregar();},[]);
  async function decidir(id:string,status:'aprovado'|'rejeitado'){ const s=createSupabaseBrowserClient(); const {error}=await s.from('aprovacoes').update({status,administrador_id:adminId,reenviado:false,atualizado_em:new Date().toISOString()}).eq('id',id); if(error){setErro(error.message);return;} await carregar(); }
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Administrador</span><h2>Aprovações</h2></div></div>{erro&&<div className="error-box">{erro}</div>}<div className="material-flow-list">{itens.map(a=><article className="material-flow-card" key={a.id}><div className="material-flow-head"><div><strong>{a.chamado?.protocolo||'Chamado'}</strong><span>{a.chamado?.site_nome||'Site não informado'} · PVF {a.chamado?.pvf_total??'—'}</span></div><span className={`ticket-status st-${a.status}`}>{a.status}</span></div>{a.observacao&&<p>{a.observacao}</p>}{a.status==='pendente'&&<div className="photo-actions"><button className="button primary" onClick={()=>void decidir(a.id,'aprovado')}>Aprovar</button><button className="button secondary" onClick={()=>void decidir(a.id,'rejeitado')}>Rejeitar</button></div>}</article>)}</div></section>;
}
