(function(){
 'use strict';
 const motivos={pedido_cliente:'A pedido do cliente',local_fechado:'Local fechado',feriado:'Feriado',fortes_chuvas:'Fortes chuvas',falta_energia:'Falta de energia',horario_expediente:'Horário de expediente'};
 const estados={solicitada:'Aguardando operador',aprovada:'Pendência autorizada',rejeitada:'Pendência não autorizada',encerrada:'Pendência finalizada'};
 let registros=[],carregando=false,chamadoAtual='';
 const e=id=>document.getElementById(id);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
 const ultima=id=>registros.filter(r=>r.chamado_id===id).sort((a,b)=>String(b.solicitado_em).localeCompare(String(a.solicitado_em)))[0];

 function garantirInterface(){
  if(e('nf-modal-pendencia'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="nf-modal-pendencia"><div class="modal-box" style="max-width:560px"><div class="modal-hd"><h3>Solicitar pendência</h3><button class="close" id="nf-fechar-pendencia" type="button">×</button></div><form id="nf-form-pendencia"><div class="modal-bd"><div class="info" id="nf-pendencia-chamado"></div><div class="form-group"><label class="label">Situação permitida</label><select class="select" id="nf-pendencia-motivo" required><option value="">Selecione...</option>${Object.entries(motivos).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></div><div class="grid-2"><div class="form-group"><label class="label">Novo prazo (aprazamento)</label><input class="input" id="nf-pendencia-aprazamento" type="datetime-local" required></div><div class="form-group"><label class="label">Saída programada da pendência</label><input class="input" id="nf-pendencia-saida" type="datetime-local" required></div></div><div class="form-group"><label class="label">Mensagem da pendência</label><textarea class="input" id="nf-pendencia-mensagem" rows="4" maxlength="2000" required placeholder="Descreva a situação e as informações para o operador"></textarea></div><div id="nf-pendencia-status" class="info hidden"></div></div><div class="modal-ft"><button class="btn btn-s" id="nf-cancelar-pendencia" type="button">Cancelar</button><button class="btn btn-y" id="nf-enviar-pendencia" type="submit">Enviar ao operador</button></div></form></div></div>`);
  e('nf-fechar-pendencia').addEventListener('click',fechar);e('nf-cancelar-pendencia').addEventListener('click',fechar);e('nf-form-pendencia').addEventListener('submit',enviar);
 }
 function abrir(id){
  garantirInterface();const c=typeof D!=='undefined'?D.ch.find(x=>String(x.id)===String(id)):null;if(!c)return;
  if(ultima(id)?.status==='solicitada'||ultima(id)?.status==='aprovada'){alert('Este chamado já possui uma pendência em andamento.');return;}
  const horasSla=c.re==='interior'?8:6;chamadoAtual=id;e('nf-pendencia-chamado').innerHTML=`<b>${safe(c.pr)}</b><br>${safe(c.si)}<br>SLA: ${horasSla===6?'Capital — 6 horas':'Interior — 8 horas'}`;e('nf-form-pendencia').reset();e('nf-pendencia-status').classList.add('hidden');
  const agora=new Date(Date.now()+60*60*1000),saida=new Date(Date.now()+horasSla*60*60*1000);for(const d of [agora,saida])d.setMinutes(d.getMinutes()-d.getTimezoneOffset());e('nf-pendencia-saida').value=agora.toISOString().slice(0,16);e('nf-pendencia-aprazamento').value=saida.toISOString().slice(0,16);e('nf-modal-pendencia').classList.add('a');
 }
 function fechar(){e('nf-modal-pendencia')?.classList.remove('a');chamadoAtual='';}
 async function enviar(ev){
  ev.preventDefault();const c=typeof D!=='undefined'?D.ch.find(x=>String(x.id)===String(chamadoAtual)):null,btn=e('nf-enviar-pendencia'),saida=new Date(e('nf-pendencia-saida').value),aprazamento=new Date(e('nf-pendencia-aprazamento').value),msg=e('nf-pendencia-status');
  try{
   if(!c||typeof SB_PROFILE==='undefined'||!SB_PROFILE||SB_PROFILE.tipo!=='tecnico')throw new Error('Sessão técnica inválida.');
   if(saida<=new Date()||aprazamento<=new Date())throw new Error('As duas datas precisam estar no futuro.');
   if(saida>aprazamento)throw new Error('A saída da pendência precisa ocorrer antes do novo prazo.');
   btn.disabled=true;btn.textContent='Enviando...';msg.classList.remove('hidden');msg.textContent='Enviando solicitação ao operador...';
   const {data:row,error}=await SB.from('solicitacoes_pendencia').insert({chamado_id:c.id,tecnico_id:SB_PROFILE.id,origem:'tecnico',solicitado_por_nome:SB_PROFILE.nome,solicitado_por_email:SB_PROFILE.email||null,motivo:e('nf-pendencia-motivo').value,mensagem:e('nf-pendencia-mensagem').value.trim(),aprazado_para:aprazamento.toISOString(),saida_programada_em:saida.toISOString()}).select().single();if(error)throw error;
   registros.unshift(row);msg.textContent='Solicitação enviada. Aguarde a decisão do operador.';renderAdmin();if(typeof rTat==='function')rTat();setTimeout(fechar,1200);
  }catch(err){msg.classList.remove('hidden');msg.textContent=err.message||'Não foi possível enviar a solicitação.';}finally{btn.disabled=false;btn.textContent='Enviar ao operador';}
 }
 async function carregar(){
  if(carregando||typeof SB_PROFILE==='undefined'||!SB_PROFILE)return;carregando=true;
  try{const {data:rows,error}=await SB.from('solicitacoes_pendencia').select('*').order('solicitado_em',{ascending:false}).limit(500);if(error)throw error;registros=rows||[];renderAdmin();if(SB_PROFILE.tipo==='tecnico'&&typeof rTat==='function')rTat();}catch(err){console.warn('Pendências:',err.message);}finally{carregando=false;}
 }
 function resumoTecnico(id){const r=ultima(id);if(!r)return '';const cor=r.status==='aprovada'?'var(--g)':r.status==='rejeitada'?'var(--r)':'var(--y)';return `<div class="info" style="margin-top:8px;border-left:4px solid ${cor}"><b>${safe(estados[r.status]||r.status)}</b><br>${safe(motivos[r.motivo]||r.motivo)} — ${safe(r.mensagem)}<br>Novo prazo: ${safe(data(r.aprazado_para))} • Saída programada: ${safe(data(r.saida_programada_em))}${r.decisao_mensagem?`<br><b>Retorno do operador:</b> ${safe(r.decisao_mensagem)}`:''}</div>`;}
 function renderAdmin(){
  const box=e('lista-pendencias-admin');if(!box||typeof SB_PROFILE==='undefined'||SB_PROFILE?.tipo!=='admin')return;
  box.innerHTML=registros.map(r=>{const c=typeof D!=='undefined'?D.ch.find(x=>x.id===r.chamado_id):null;return `<div class="os"><div class="os-h"><span class="os-id">${safe(c?.pr||'Chamado')}</span><span class="badge ${r.status==='aprovada'?'b-concluida':r.status==='rejeitada'?'b-recusado':'b-pendente'}">${safe(estados[r.status]||r.status)}</span></div><div class="os-r"><b>Solicitado por:</b> ${safe(r.solicitado_por_nome)} (${r.origem==='tecnico'?'Técnico':'Operador'})</div><div class="os-r"><b>Situação:</b> ${safe(motivos[r.motivo]||r.motivo)}</div><div class="os-r"><b>Mensagem:</b> ${safe(r.mensagem)}</div><div class="os-r"><b>Novo prazo:</b> ${safe(data(r.aprazado_para))} • <b>Saída programada:</b> ${safe(data(r.saida_programada_em))}</div>${r.decidido_por_nome?`<div class="os-r"><b>Decisão do operador:</b> ${safe(r.decidido_por_nome)} em ${safe(data(r.decidido_em))}</div>`:''}</div>`;}).join('')||'<div class="empty">Nenhuma solicitação de pendência registrada.</div>';
 }
 document.addEventListener('click',ev=>{const b=ev.target.closest('.nf-solicitar-pendencia');if(b)abrir(b.dataset.id);});
 document.addEventListener('DOMContentLoaded',()=>{garantirInterface();setTimeout(carregar,1800);setInterval(()=>typeof SB_PROFILE!=='undefined'&&SB_PROFILE&&carregar(),30000);});
 if(typeof SB!=='undefined')SB.channel('pendencias-internas').on('postgres_changes',{event:'*',schema:'public',table:'solicitacoes_pendencia'},carregar).on('postgres_changes',{event:'UPDATE',schema:'public',table:'chamados'},carregar).subscribe();
 window.NexoFieldPendencias={abrir,carregar,renderAdmin,resumoTecnico};
})();
