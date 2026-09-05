'use client';

import { useEffect,useState } from 'react';
import { registrarPosicao } from './tracking.service';

export function TechnicianTracking({chamadoId,tecnicoId}:{chamadoId:string;tecnicoId:string}){const [estado,setEstado]=useState('Solicitando localização...');useEffect(()=>{if(!navigator.geolocation){setEstado('Localização indisponível neste aparelho.');return;}let ultimo=0;const id=navigator.geolocation.watchPosition(pos=>{const agora=Date.now();if(agora-ultimo<30000)return;ultimo=agora;void registrarPosicao(chamadoId,tecnicoId,pos).then(()=>setEstado('Rastreamento ativo durante o atendimento.')).catch(()=>setEstado('Não foi possível atualizar a localização.'));},()=>setEstado('Permissão de localização não autorizada.'),{enableHighAccuracy:true,maximumAge:15000,timeout:20000});return()=>navigator.geolocation.clearWatch(id);},[chamadoId,tecnicoId]);return <div className="helper-text">📍 {estado}</div>;}
