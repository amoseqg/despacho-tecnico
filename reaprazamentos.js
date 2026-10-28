(function(){
 'use strict';
 let registros=[],ocupado=false;
 const e=id=>document.getElementById(id);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const localInput=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T');
 const porChamado=id=>registros.filter(r=>String(r.chamado_id)===String(id)).sort((a,b)=>String(b.solicitado_em).localeCompare(String(a.solicitado_em)));
 function botao(c){
  if(S?.t!=='tec'||SB_PROFILE?.tipo!=='tecnico'||c?.st!=='andamento')return '';
  const r=porChamado(c.id)[0];
  if(r?.status==='solicitada')return '<span class="badge b-pendente">⏳ Reaprazamento aguardando administrador</span>';
  return `<button type="button" class="btn btn-y nf-solicitar-reaprazamento" data-id="${safe(c.id)}" style="padding:6px 10px;font-size:.7rem">📅 Solicitar reaprazamento</button>`;
 }
 function resumoTecnico(id){
  const r=porChamado(id)[0];if(!r)return '';
  const aprovado=r.status==='aprovada',rejeitado=r.status==='rejeitada';
  const cor=aprovado?'var(--g)':rejeitado?'var(--r)':'var(--y)';
  return `<div class="info" style="margin-top:8px;border-left:4px solid ${cor}"><b>${aprovado?'Reaprazamento aprovado':rejeitado?'Reaprazamento recusado':'Solicitação de reaprazamento enviada ao administrador'}</b><br><b>Motivo informado:</b> ${safe(r.motivo)}${r.novo_vencimento?`<br><b>Novo vencimento:</b> ${safe(data(r.novo_vencimento))}`:''}${r.resposta_admin?`<br><b>Resposta do administrador:</b> ${safe(r.resposta_admin)}`:''}</div>`;
 }
 function abrirSolicitacao(id,b){
  if(S?.t!=='tec'||SB_PROFILE?.tipo!=='tecnico')return;
  const c=D.ch.find(x=>String(x.id)===String(id));if(!c||c.st!=='andamento')return;
  const dialog=document.createElement('dialog');dialog.style.cssText='width:min(560px,calc(100% - 24px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0005';
  dialog.innerHTML=`<form><h3>Solicitar reaprazamento do chamado</h3><div class="info"><b>${safe(c.pr)} — ${safe(c.si)}</b><br>O administrador analisará o motivo e decidirá se altera o vencimento.</div><label style="display:block;margin:16px 0">Motivo da solicitação<textarea class="input" name="motivo" rows="4" required minlength="3" maxlength="1000" placeholder="Explique por que é necessário ampliar o prazo do atendimento."></textarea></label><p class="erro" role="alert" style="color:#b91c1c"></p><div style="display:flex;justify-content:flex-end;gap:12px"><button class="btn btn-s cancelar" type="button">Cancelar</button><button class="btn btn-y enviar" type="submit">Enviar ao administrador</button></div></form>`;
  document.body.append(dialog);dialog.showModal();dialog.querySelector('.cancelar').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const form=dialog.querySelector('form'),enviar=form.querySelector('.enviar'),erro=form.querySelector('.erro');
  form.onsubmit=async ev=>{
   ev.preventDefault();if(enviar.disabled)return;enviar.disabled=true;b.disabled=true;enviar.textContent='Enviando...';
   try{
    const {data:{user},error:authError}=await SB.auth.getUser();if(authError)throw authError;if(!user||user.id!==SB_PROFILE.id)throw new Error('Sua sessão expirou. Entre novamente e tente outra vez.');
    const {data:r,error}=await SB.rpc('solicitar_reaprazamento_admin',{p_chamado_id:c.id,p_motivo:form.elements.motivo.value.trim()});
    if(error)throw error;if(!r?.id)throw new Error('O servidor não confirmou a solicitação.');
    registros=[r,...registros.filter(x=>x.id!==r.id)];dialog.close();if(typeof rTat==='function')rTat();
    nfToast('Solicitação enviada ao administrador.','sucesso');
   }catch(err){erro.textContent=err?.message||'Não foi possível enviar a solicitação.';enviar.disabled=false;b.disabled=false;enviar.textContent='Enviar ao administrador';}
  };
 }
 function renderAdmin(){
  const box=e('lista-reaprazamentos-admin');
  if(!box||SB_PROFILE?.tipo!=='admin')return;
  const lista=registros.filter(r=>D.ch.some(c=>String(c.id)===String(r.chamado_id)&&chamadoVisivel(c)));
  const pendentes=lista.filter(r=>r.status==='solicitada');
  const historico=lista.filter(r=>r.status!=='solicitada').slice(0,30);
  const card=r=>{
   const c=D.ch.find(x=>String(x.id)===String(r.chamado_id));
   const tecnico=D.tc.find(x=>String(x._id||x.id)===String(r.tecnico_id));
   return `<article class="os"><div class="os-h"><b>${safe(c?.pr||'Chamado')} — ${safe(c?.si||'')}</b><span class="badge ${r.status==='aprovada'?'b-concluida':r.status==='rejeitada'?'b-recusado':'b-pendente'}">${r.status==='solicitada'?'Aguardando análise':r.status==='aprovada'?'Aprovada':'Recusada'}</span></div><div class="os-r"><b>Técnico:</b> ${safe(tecnico?.n||r.tecnico_nome)} • <b>Solicitado em:</b> ${safe(data(r.solicitado_em))}</div><div class="info" style="margin:8px 0"><b>Motivo informado:</b><br>${safe(r.motivo)}</div><div class="os-r"><b>Vencimento atual ao solicitar:</b> ${safe(data(r.vencimento_anterior))}${r.novo_vencimento?`<br><b>Novo vencimento aprovado:</b> ${safe(data(r.novo_vencimento))}`:''}${r.resposta_admin?`<br><b>Resposta:</b> ${safe(r.resposta_admin)}`:''}</div>${r.status==='solicitada'?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn btn-g nf-decidir-reaprazamento" data-id="'+safe(r.id)+'" data-decisao="aprovada">✅ Aprovar e definir vencimento</button><button type="button" class="btn btn-r nf-decidir-reaprazamento" data-id="'+safe(r.id)+'" data-decisao="rejeitada">✖ Recusar sem alterar prazo</button></div>':''}</article>`;
  };
  box.innerHTML='<h3>Solicitações de reaprazamento</h3><p class="info">Analise o motivo informado pelo técnico. Ao aprovar, defina o novo vencimento; ao recusar, o prazo atual será mantido.</p>'+(pendentes.map(card).join('')||'<div class="empty">Nenhuma solicitação aguardando análise.</div>')+(historico.length?'<details style="margin-top:12px"><summary>Histórico de decisões</summary>'+historico.map(card).join('')+'</details>':'');
 }
 function decidir(id,decisao,b){
  if(SB_PROFILE?.tipo!=='admin')return;
  const r=registros.find(x=>x.id===id&&x.status==='solicitada');if(!r)return;
  const atual=D.ch.find(c=>String(c.id)===String(r.chamado_id));
  const min=localInput(new Date(Math.max(Date.parse(atual?.vencimento||r.vencimento_anterior||0)||0,Date.now())+60000));
  const dialog=document.createElement('dialog');dialog.style.cssText='width:min(560px,calc(100% - 24px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0005';
  const aprovar=decisao==='aprovada';
  dialog.innerHTML=`<form><h3>${aprovar?'Aprovar reaprazamento':'Recusar reaprazamento'}</h3><div class="info"><b>${safe(atual?.pr||'Chamado')} — ${safe(atual?.si||'')}</b><br><b>Motivo do técnico:</b> ${safe(r.motivo)}<br><b>Vencimento atual:</b> ${safe(data(atual?.vencimento||r.vencimento_anterior))}</div>${aprovar?'<label style="display:block;margin:16px 0">Novo vencimento (horário de Brasília)<input class="input" name="novoVencimento" type="datetime-local" min="'+min+'" required></label>':''}<label style="display:block;margin:16px 0">Resposta ao técnico<textarea class="input" name="resposta" rows="3" required minlength="3" maxlength="1000" placeholder="${aprovar?'Informe a decisão e a justificativa.':'Informe por que o prazo será mantido.'}"></textarea></label><p class="erro" role="alert" style="color:#b91c1c"></p><div style="display:flex;justify-content:flex-end;gap:12px"><button class="btn btn-s cancelar" type="button">Cancelar</button><button class="btn ${aprovar?'btn-g':'btn-r'} salvar" type="submit">${aprovar?'Confirmar vencimento':'Confirmar recusa'}</button></div></form>`;
  document.body.append(dialog);dialog.showModal();dialog.querySelector('.cancelar').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const form=dialog.querySelector('form'),salvar=form.querySelector('.salvar'),erro=form.querySelector('.erro');
  form.onsubmit=async ev=>{
   ev.preventDefault();if(salvar.disabled)return;salvar.disabled=true;b.disabled=true;
   try{
    await sbExigirSessaoAdmin();
    const novo=form.elements.novoVencimento?.value;
    const novoISO=novo?new Date(novo+':00-03:00').toISOString():null;
    const {data:decidida,error}=await SB.rpc('decidir_reaprazamento_admin',{p_solicitacao_id:id,p_decisao:decisao,p_novo_vencimento:novoISO,p_resposta:form.elements.resposta.value.trim()});
    if(error)throw error;if(!decidida?.id)throw new Error('O servidor não confirmou a decisão.');
    registros=registros.map(x=>x.id===decidida.id?decidida:x);dialog.close();
    await sbRecarregarDados();await carregar();renderAdmin();if(typeof rAt==='function')rAt();if(typeof rTat==='function')rTat();
    nfToast(decisao==='aprovada'?'Reaprazamento aprovado e novo vencimento registrado.':'Solicitação recusada; o vencimento foi mantido.','sucesso');
   }catch(err){erro.textContent=err?.message||'Não foi possível salvar a decisão.';salvar.disabled=false;b.disabled=false;}
  };
 }
 async function carregar(){
  if(ocupado||typeof SB_PROFILE==='undefined'||!SB_PROFILE)return;ocupado=true;
  try{
   const {data:rows,error}=await SB.from('solicitacoes_reaprazamento_admin').select('*').order('solicitado_em',{ascending:false}).limit(500);
   if(error)throw error;registros=rows||[];
   if(SB_PROFILE.tipo==='admin')renderAdmin();if(SB_PROFILE.tipo==='tecnico'&&typeof rTat==='function')rTat();
  }catch(err){console.warn('Solicitações de reaprazamento:',err.message);}finally{ocupado=false;}
 }
 document.addEventListener('click',ev=>{
  const s=ev.target.closest('.nf-solicitar-reaprazamento'),d=ev.target.closest('.nf-decidir-reaprazamento');
  if(s)abrirSolicitacao(s.dataset.id,s);
  if(d)decidir(d.dataset.id,d.dataset.decisao,d);
 });
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(carregar,1400);setInterval(()=>{if(typeof SB_PROFILE!=='undefined'&&SB_PROFILE)carregar();},20000);});
 if(typeof SB!=='undefined')SB.channel('solicitacoes-reaprazamento-admin').on('postgres_changes',{event:'*',schema:'public',table:'solicitacoes_reaprazamento_admin'},carregar).subscribe();
 window.NexoFieldReaprazamento={botao,resumoTecnico,renderAdmin,carregar};
})();