(function(){
 'use strict';
 let registros=[],ocupado=false,perfil='';
 const e=id=>document.getElementById(id),safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const ativo=id=>registros.find(r=>r.chamado_id===id&&r.status==='pausado');
 function botao(c){
  if(typeof SB_PROFILE==='undefined'||SB_PROFILE?.tipo!=='admin'||!['aberto','pendente','andamento'].includes(c.st))return '';
  const r=ativo(c.id);
  return r?`<button type="button" class="btn btn-g nf-liberar-expediente" data-id="${safe(r.id)}">▶ Liberar chamado</button><span class="badge b-pendente">⏸ Horário de atendimento</span>`:c.pendenciaAtiva?'':`<button type="button" class="btn btn-y nf-pendenciar-expediente" data-id="${safe(c.id)}">⏸ Pendenciar por horário</button>`;
 }
 function renderizar(){
  const box=e('nf-lista-expediente');if(!box||typeof SB_PROFILE==='undefined'||SB_PROFILE?.tipo!=='admin')return;
  const visiveis=registros.filter(r=>{const c=D.ch.find(c=>c.id===r.chamado_id);return c&&chamadoVisivel(c);});
  box.innerHTML='<h3>Pendências por horário de atendimento</h3>'+ (visiveis.map(r=>{const c=D.ch.find(c=>c.id===r.chamado_id);return `<div class="os"><div class="os-h"><b>${safe(c.pr)} — ${safe(c.si)}</b><span class="badge b-${r.status==='pausado'?'pendente':'concluida'}">${r.status==='pausado'?'Prazo pausado':r.status==='liberado'?'Liberado':'Finalizado'}</span></div><p>${safe(r.motivo)}</p><div class="os-r"><b>Administrador:</b> ${safe(r.administrador_nome)}<br><b>Retorno programado:</b> ${data(r.retorno_em)}<br><b>Prazo após liberação:</b> ${data(r.vencimento_reprogramado)}<br><b>Tempo restante preservado:</b> ${Math.floor(r.prazo_restante_segundos/3600)}h ${Math.floor(r.prazo_restante_segundos%3600/60)}min<br><b>Expediente:</b> ${safe(r.inicio_expediente)} às ${safe(r.fim_expediente)}${r.liberado_em?`<br><b>Liberado em:</b> ${data(r.liberado_em)}`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${r.status==='pausado'?`<button class="btn btn-g nf-liberar-expediente" data-id="${safe(r.id)}">▶ Liberar chamado</button>`:''}<button class="btn btn-r nf-pendencia-excluir" data-id="${safe(c.id)}">Excluir chamado da lista</button></div></div>`;}).join('')||'<div class="empty">Nenhuma pendência administrativa por expediente.</div>');
 }
 async function carregar(){
  if(ocupado||typeof SB_PROFILE==='undefined'||!SB_PROFILE)return;ocupado=true;const dono=SB_PROFILE.id;
  try{
   const linhas=[];for(let offset=0;;offset+=500){const {data,error}=await SB.from('pendencias_expediente_admin').select('*').order('criado_em',{ascending:false}).range(offset,offset+499);if(error)throw error;linhas.push(...data);if(data.length<500)break;}
   if(SB_PROFILE?.id!==dono)return;registros=linhas;perfil=dono;renderizar();
   if(SB_PROFILE.tipo==='admin'){rCh();rAt();}else if(SB_PROFILE.tipo==='tecnico')rTat();
  }catch(err){console.warn('Pendências de expediente:',err.message);}finally{ocupado=false;}
 }
 function campoLocalBrasil(d){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T');}
 function proximoExpediente(){
  let dia=campoLocalBrasil(new Date()).slice(0,10);let d=new Date(dia+'T08:00:00-03:00');
  if(d<=new Date())d=new Date(d.getTime()+86400000);
  while([0,6].includes(new Date(d.getTime()-3*3600000).getUTCDay()))d=new Date(d.getTime()+86400000);
  return campoLocalBrasil(d);
 }
 function abrir(id){
  if(SB_PROFILE?.tipo!=='admin')return;const c=D.ch.find(c=>c.id===id);if(!c)return;
  const dialog=document.createElement('dialog');dialog.style.cssText='width:min(660px,calc(100% - 24px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0005';
  dialog.innerHTML=`<form><h3>Pendenciar por horário de atendimento</h3><div class="info"><b>${safe(c.pr)} — ${safe(c.si)}</b><br>Horário cadastrado do cliente: ${safe(c.horario||'Não informado')}<br>O prazo fica pausado até a liberação e retoma com o tempo restante.</div><div class="grid-2" style="gap:16px;margin-top:16px"><label>Início do expediente<input class="input" type="time" name="inicio" value="08:00" required></label><label>Fim do expediente<input class="input" type="time" name="fim" value="18:00" required></label></div><fieldset style="margin:16px 0;border:1px solid #ddd;border-radius:8px;padding:12px"><legend>Dias de funcionamento do cliente</legend><div style="display:flex;gap:12px;flex-wrap:wrap">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((n,i)=>`<label><input type="checkbox" name="dias" value="${i}" ${i>0&&i<6?'checked':''}> ${n}</label>`).join('')}</div></fieldset><label style="display:block;margin-bottom:16px">Datas sem expediente / feriados do cliente<input class="input" name="feriados" placeholder="Ex.: 2026-10-12, 2026-11-02"><small>Informe as datas aplicáveis ao local, separadas por vírgula.</small></label><label style="display:block;margin-bottom:16px">Liberar automaticamente em (horário de Brasília)<input class="input" type="datetime-local" name="retorno" value="${proximoExpediente()}" required></label><label style="display:block">Motivo<textarea class="input" name="motivo" rows="3" required minlength="3" maxlength="2000">Fora do horário de atendimento do cliente.</textarea></label><p class="erro" role="alert" style="color:#b91c1c"></p><p style="font-size:13px">A liberação deve ocorrer em dia válido e permitir que o prazo restante caiba antes do fechamento. Você também poderá liberar manualmente dentro desse expediente.</p><div style="display:flex;justify-content:flex-end;gap:12px"><button class="btn btn-s cancelar" type="button">Cancelar</button><button class="btn btn-y salvar" type="submit">Confirmar pendência</button></div></form>`;
  document.body.append(dialog);dialog.showModal();dialog.querySelector('.cancelar').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();const f=ev.currentTarget,b=f.querySelector('.salvar'),erro=f.querySelector('.erro');if(b.disabled)return;
   const dias=[...f.querySelectorAll('[name=dias]:checked')].map(x=>Number(x.value)),feriados=f.elements.feriados.value.split(',').map(x=>x.trim()).filter(Boolean);
   if(!dias.length||feriados.some(x=>!/^\d{4}-\d{2}-\d{2}$/.test(x))){erro.textContent='Marque os dias de expediente e informe os feriados no formato AAAA-MM-DD.';return;}
   b.disabled=true;try{
    await sbExigirSessaoAdmin();
    const {data:r,error}=await SB.rpc('pendenciar_expediente_admin',{p_chamado_id:id,p_retorno:new Date(f.elements.retorno.value+':00-03:00').toISOString(),p_inicio:f.elements.inicio.value,p_fim:f.elements.fim.value,p_dias:dias,p_feriados:feriados,p_motivo:f.elements.motivo.value.trim()});if(error)throw error;if(!r?.id)throw new Error('O servidor não confirmou a pendência.');
    registros.unshift(r);c.pendenciaAtiva=true;c.pendenciaDesde=r.criado_em;c.vencimento=r.vencimento_reprogramado;dialog.close();renderizar();rCh();rAt();rDb();nfToast('Prazo pausado. Retorno automático: '+data(r.retorno_em),'sucesso');await sbRecarregarDados();
   }catch(err){erro.textContent=err.message;}finally{b.disabled=false;}
  };
 }
 async function liberar(id,b){
  if(SB_PROFILE?.tipo!=='admin')return;if(!confirm('Liberar o chamado agora e retomar o prazo restante? A liberação será validada pelo expediente cadastrado.'))return;
  b.disabled=true;try{await sbExigirSessaoAdmin();const {data:r,error}=await SB.rpc('liberar_expediente_admin',{p_pendencia_id:id});if(error)throw error;if(r?.status!=='liberado')throw new Error('O servidor não confirmou a liberação.');registros=registros.map(x=>x.id===id?r:x);await sbRecarregarDados();renderizar();nfToast('Chamado liberado com o prazo restante preservado.','sucesso');}catch(err){sbShowError('Não foi possível liberar o chamado',err);}finally{b.disabled=false;}
 }
 function resumo(id){const r=ativo(id);return r?`<div class="info"><b>Prazo pausado pelo administrador — horário de atendimento</b><br>${safe(r.motivo)}<br>Retorno programado: ${data(r.retorno_em)}<br>Vencimento reprogramado: ${data(r.vencimento_reprogramado)}</div>`:'';}
 document.addEventListener('click',async ev=>{const p=ev.target.closest('.nf-pendenciar-expediente'),l=ev.target.closest('.nf-liberar-expediente'),x=ev.target.closest('.nf-pendencia-excluir');if(p)abrir(p.dataset.id);if(l)liberar(l.dataset.id,l);if(x){await excluirChamado(x.dataset.id);window.NexoFieldPendencias?.renderAdmin();renderizar();}});
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(carregar,1800);setInterval(()=>{if(typeof SB_PROFILE!=='undefined'&&SB_PROFILE){if(perfil!==SB_PROFILE.id)registros=[];carregar();}},30000);});
 if(typeof SB!=='undefined')SB.channel('expediente-administrador').on('postgres_changes',{event:'*',schema:'public',table:'pendencias_expediente_admin'},async()=>{await sbRecarregarDados();carregar();}).subscribe();
 window.NexoFieldExpediente={botao,abrir,carregar,renderizar,resumo};
})();
