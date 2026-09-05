'use client';

import { useEffect } from 'react';
import { registrarPosicao } from './tracking.service';

export function TechnicianTracking({chamadoId,tecnicoId}:{chamadoId:string;tecnicoId:string}){useEffect(()=>{if(!navigator.geolocation)return;let ultimo=0;const id=navigator.geolocation.watchPosition(pos=>{const agora=Date.now();if(agora-ultimo<30000)return;ultimo=agora;void registrarPosicao(chamadoId,tecnicoId,pos).catch(error=>console.warn('Não foi possível atualizar a localização.',error));},error=>console.warn('Localização não autorizada.',error),{enableHighAccuracy:true,maximumAge:15000,timeout:20000});return()=>navigator.geolocation.clearWatch(id);},[chamadoId,tecnicoId]);return null;}
