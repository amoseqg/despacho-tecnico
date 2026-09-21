'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type PosicaoTecnico={chamado_id:string;tecnico_id:string;latitude:number;longitude:number;precisao_metros:number|null;registrado_em:string;chamado?:{protocolo?:string|null;site_nome?:string|null;status?:string|null;tecnico?:{nome?:string|null}|null}|null};

export async function aceitarChamado(chamadoId:string,tecnicoId:string){const agora=new Date().toISOString();const {data,error}=await createSupabaseBrowserClient().from('chamados').update({status:'andamento',aceito_em:agora,iniciado_em:agora,atualizado_em:agora}).eq('id',chamadoId).eq('tecnico_id',tecnicoId).select('id,status').single();if(error)throw error;if(data.status!=='andamento')throw new Error('Aceite não confirmado.');}
export async function registrarPosicao(chamadoId:string,tecnicoId:string,pos:GeolocationPosition){const {error}=await createSupabaseBrowserClient().from('rastreamento_tecnico').insert({chamado_id:chamadoId,tecnico_id:tecnicoId,latitude:pos.coords.latitude,longitude:pos.coords.longitude,precisao_metros:pos.coords.accuracy,registrado_em:new Date(pos.timestamp).toISOString()});if(error)throw error;}
export async function listarUltimasPosicoes(){const {data,error}=await createSupabaseBrowserClient().from('rastreamento_tecnico').select('chamado_id,tecnico_id,latitude,longitude,precisao_metros,registrado_em,chamado:chamados(protocolo,site_nome,status,tecnico:perfis!chamados_tecnico_id_fkey(nome))').order('registrado_em',{ascending:false}).limit(500);if(error)throw error;const mapa=new Map<string,PosicaoTecnico>();for(const p of (data??[]) as unknown as PosicaoTecnico[])if(!mapa.has(p.chamado_id))mapa.set(p.chamado_id,p);return [...mapa.values()].filter(p=>p.chamado?.status==='andamento');}
