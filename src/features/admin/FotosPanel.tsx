'use client';

import { useEffect,useMemo,useState } from 'react';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

type Foto={id:string;chamado_id:string;caminho:string;criado_em:string;chamado?:{protocolo?:string|null;site_nome?:string|null;status?:string|null;tecnico?:{nome?:string|null}|null}|null};

export function FotosPanel(){
 const [fotos,setFotos]=useState<Foto[]>([]);const [busca,setBusca]=useState('');const [erro,setErro]=useState('');
 useEffect(()=>{createSupabaseBrowserClient().from('fotos_atividade').select('id,chamado_id,caminho,criado_em,chamado:chamados(protocolo,site_nome,status,tecnico:perfis!chamados_tecnico_id_fkey(nome))').order('criado_em',{ascending:false}).limit(300).then(({data,error})=>{if(error)setErro(error.message);else setFotos((data??[]) as unknown as Foto[]);});},[]);
 const grupos=useMemo(()=>{const termo=busca.trim().toLowerCase();const mapa=new Map<string,Foto[]>();for(const f of fotos){if(f.chamado?.status!=='concluida')continue;const texto=`${f.chamado?.protocolo??''} ${f.chamado?.site_nome??''} ${f.chamado?.tecnico?.nome??''}`.toLowerCase();if(termo&&!texto.includes(termo))continue;mapa.set(f.chamado_id,[...(mapa.get(f.chamado_id)??[]),f]);}return [...mapa.values()];},[fotos,busca]);
 async function abrir(f:Foto){const {data,error}=await createSupabaseBrowserClient().storage.from('fotos-atividades').createSignedUrl(f.caminho,600);if(error)setErro(error.message);else window.open(data.signedUrl,'_blank','noopener');}
 return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Administrador</span><h2>Registros fotográficos</h2></div></div><div className="admin-search-row"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por chamado, site ou técnico" /></div>{erro&&<div className="error-box">{erro}</div>}<div className="report-grid">{grupos.map(g=><article className="report-card" key={g[0].chamado_id}><strong>{g[0].chamado?.protocolo} — {g[0].chamado?.site_nome}</strong><span>Técnico: {g[0].chamado?.tecnico?.nome||'—'}</span><span>{g.length} registro(s) fotográfico(s)</span><div className="table-actions">{g.map((f,i)=><button className="button secondary" key={f.id} onClick={()=>void abrir(f)}>Abrir foto {i+1}</button>)}</div></article>)}</div></section>;
}
