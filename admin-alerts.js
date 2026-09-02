/* Central administrativa: usa somente dados já autorizados e carregados pelo app. */
(function(root){
  'use strict';
  const TWO_HOURS=7200000,DAY=86400000;
  const time=v=>v ? Date.parse(v) : NaN;
  function recife(now){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
    return {day:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
  }
  function daysUntil(value,now){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
    const n=Date.parse(value+'T12:00:00Z');
    if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)return null;
    return Math.round((n-Date.parse(recife(now).day+'T12:00:00Z'))/DAY);
  }
  function build(data,now,helpers){
    const open=(data.ch||[]).filter(c=>['pendente','andamento'].includes(c.st));
    const calls=open.map(c=>{
      const start=time(c.am),valid=Number.isFinite(start)&&start<=now;
      return {c,remaining:c.st==='andamento'&&valid?helpers.limit-(now-start):null,
        previous:helpers.previous(c),slot:Math.max(0,Math.floor((now-(valid?start:time(c.cr)||now))/TWO_HOURS))};
    });
    const deliveries=(data.mr||[]).filter(r=>!['entregue','cancelado'].includes(r.status)&&helpers.interior(r)).map(r=>{
      const meta=helpers.meta(r);return {r,meta,days:daysUntil(meta.prazo,now)};
    });
    return {calls,deliveries,local:recife(now)};
  }
  function due(state,model,now){
    const keys=model.calls.map(x=>'call:'+x.c.id+':'+x.slot);
    if(model.deliveries.length)keys.push('delivery:'+Math.floor(now/TWO_HOURS));
    if(model.local.hour>=8)keys.push('summary:'+model.local.day);
    return keys.filter(k=>!state[k]);
  }
  root.NFAdminAlertsCore={build,due,daysUntil,recife};
  if(typeof document==='undefined')return;
  let panel,body,banner,lastSync=0,failed=false,memory={},owner='';
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function duration(ms){const m=Math.ceil(Math.abs(ms)/60000);return `${Math.floor(m/60)}h ${m%60}min`;}
  function stateKey(){return 'nf-admin-alerts-v1:'+owner;}
  function loadState(){try{return JSON.parse(localStorage.getItem(stateKey())||'{}')||{};}catch(_){return memory;}}
  function saveState(state){memory=state;try{localStorage.setItem(stateKey(),JSON.stringify(state));}catch(_){}}
  function init(){
    const portal=document.getElementById('pa');if(!portal)return;
    panel=document.createElement('section');panel.className='nf-alert-center hidden';panel.setAttribute('aria-label','Central de alertas administrativos');
    panel.innerHTML='<div class="nf-alert-banner" role="status" aria-live="polite" hidden></div><details><summary>Central de alertas <span class="nf-alert-count"></span></summary><p class="nf-alert-help">Avisos a cada 2 horas com o sistema aberto. Resumo a partir das 8h de Recife. Datas de entrega cadastradas pela logística, sem consulta automática aos Correios.</p><div class="nf-alert-body"></div></details>';
    portal.querySelector('.header').after(panel);body=panel.querySelector('.nf-alert-body');banner=panel.querySelector('.nf-alert-banner');
    document.addEventListener('nf-data-ready',()=>{lastSync=Date.now();failed=false;tick();});
    document.addEventListener('nf-connection',e=>{if(!e.detail.ok){failed=true;tick();}});
    document.addEventListener('visibilitychange',tick);
    window.addEventListener('offline',tick);window.addEventListener('online',tick);
    setInterval(tick,15000);tick();
  }
  function tick(){
    if(!panel)return;
    const allowed=typeof S!=='undefined'&&S?.t==='adm'&&typeof SB_PROFILE!=='undefined'&&SB_PROFILE?.tipo==='admin';
    panel.classList.toggle('hidden',!allowed);
    if(!allowed){body.textContent='';banner.hidden=true;owner='';memory={};return;}
    const id=String(SB_PROFILE.id);
    if(owner!==id){owner=id;memory={};banner.hidden=true;}
    const now=Date.now();
    if(!lastSync||failed||!navigator.onLine||now-lastSync>120000){
      body.textContent='Dados ainda não confirmados ou conexão indisponível. Aguarde a sincronização; os prazos não serão apresentados como atualizados.';
      panel.querySelector('.nf-alert-count').textContent='— atualização pendente';banner.hidden=true;return;
    }
    const model=build(D,now,{limit:LIMITE_PRAZO_MS,previous:historicoAnteriorCircuito,interior:materialInterior,meta:logMeta});
    const callHtml=model.calls.map(({c,remaining,previous})=>{
      const status=remaining===null?'Prazo não iniciado / início não informado':remaining<0?'Atrasado '+duration(remaining):'Faltam '+duration(remaining);
      const prev=previous?.chamado;
      return `<li><strong>${safe(c.pr||'Sem protocolo')}</strong> · ${safe(c.ci||'Sem circuito')} · ${safe(nt(c.te)||'Sem técnico')}<br><span class="${remaining!==null&&remaining<0?'nf-alert-danger':''}">${safe(status)}</span>${prev?`<br>Reincidência &lt;30 dias · anterior ${safe(prev.pr)} · ${safe(nt(prev.te))} · ${safe(String(prev.ex?.atv||'Ação não informada').split('|')[0])}`:''}</li>`;
    }).join('');
    const shipmentHtml=model.deliveries.map(({r,meta,days})=>`<li><strong>${safe(nt(r.tecnico))}</strong> · ${safe(logStatus(r)[1])}<br>Rastreio: ${safe(meta.rastreamento||'Não informado')} · ${days===null?'Previsão não informada ou inválida':days<0?`Previsão ultrapassada há ${-days} dia(s)`:days===0?'Entrega prevista para hoje':`Faltam ${days} dia(s)`}${days!==null?` (${safe(meta.prazo)})`:''}</li>`).join('');
    panel.querySelector('.nf-alert-count').textContent=`(${model.calls.length} chamados · ${model.deliveries.length} entregas)`;
    body.innerHTML=`<p>Indicador de prazo: 5 horas após iniciar atendimento (não é o SLA regional). Atualizado às ${safe(new Date(lastSync).toLocaleTimeString('pt-BR',{timeZone:'America/Recife'}))}.</p><h3>${model.local.hour>=8?'Resumo diário — posição atual dos chamados despachados':'Chamados despachados — resumo diário disponível a partir das 8h'}</h3><ul>${callHtml||'<li>Nenhum chamado pendente ou em andamento.</li>'}</ul><h3>Entregas para o interior</h3><ul>${shipmentHtml||'<li>Nenhuma entrega pendente.</li>'}</ul>`;
    if(document.visibilityState==='hidden')return;
    const state=loadState(),notifications=due(state,model,now);
    if(notifications.length){
      banner.textContent=`Lembrete: ${model.calls.length} chamado(s) aberto(s) e ${model.deliveries.length} entrega(s) pendente(s). Confira a Central de alertas.`;
      banner.hidden=false;panel.querySelector('details').open=true;
      for(const k of notifications)state[k]=now;
      // Guarda só o histórico recente deste administrador; nunca confirma para outro.
      for(const k of Object.keys(state))if(now-state[k]>2*DAY)delete state[k];
      saveState(state);
    }else if(!model.calls.length&&!model.deliveries.length)banner.hidden=true;
    else if(!banner.hidden)banner.textContent=`Lembrete: ${model.calls.length} chamado(s) aberto(s) e ${model.deliveries.length} entrega(s) pendente(s). Confira a Central de alertas.`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='undefined'?globalThis:window);
