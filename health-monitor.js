(function(root){
 'use strict';
 const seen=new Map(),BUCKET='fotos-atividades';
 const profile=()=>typeof SB_PROFILE!=='undefined'?SB_PROFILE:null;
 const client=()=>root.SB;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function kind(message){const m=String(message).toLowerCase();return /401|403|jwt|rls|permission/.test(m)?['authorization','high']:/500|undefined|not a function|syntax/.test(m)?['application','critical']:/network|fetch|offline|timeout|desconect/.test(m)?['connection','high']:['unknown','medium'];}
 async function record(x={}){
  if(!client()||!profile()?.id)return;
  const message=String(x.message||'Erro sem mensagem').slice(0,1200),key=[x.source,x.action,message].join('|'),now=Date.now();
  if(now-(seen.get(key)||0)<60000)return;seen.set(key,now);
  const [error_type,severity]=kind(message);
  try{await client().from('app_error_events').insert({user_id:profile().id,source:x.source||'frontend',screen:x.screen||location.hash||location.pathname,action:x.action||null,error_code:x.code||null,error_type,severity,message,technical_details:{stack:String(x.stack||'').slice(0,4000),url:location.href,userAgent:navigator.userAgent}});}catch(_){}
 }
 root.addEventListener('error',e=>record({source:'window.error',message:e.message,stack:e.error?.stack,code:e.error?.name}));
 root.addEventListener('unhandledrejection',e=>record({source:'unhandledrejection',message:e.reason?.message||e.reason,stack:e.reason?.stack}));
 function css(){
  if(document.getElementById('nf-health-css'))return;
  const style=document.createElement('style');style.id='nf-health-css';
  style.textContent='#nf-health-button{position:fixed;right:16px;bottom:18px;z-index:100;border:2px solid #fff;border-radius:24px;background:linear-gradient(135deg,#0f766e,#0b4f6c);color:#fff;padding:8px 12px;font-size:12px;font-weight:900;letter-spacing:.2px;box-shadow:0 10px 30px #0f172a55;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}#nf-health-button:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 14px 34px #0f172a66}#nf-health-button:focus-visible{outline:4px solid #fbbf24;outline-offset:3px}@media(max-width:600px){#nf-health-button{right:10px;bottom:12px;padding:7px 10px;font-size:11px}}#nf-health-modal{position:fixed;inset:0;z-index:9998;background:#0f172acc;display:grid;place-items:center;padding:16px}#nf-health-modal[hidden]{display:none}#nf-health-card{width:min(1040px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;color:#172033}#nf-health-card table{width:100%;border-collapse:collapse;font-size:.75rem}#nf-health-card th,#nf-health-card td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}.nf-ha{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.nf-ha button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.nf-hp{background:#0f766e;color:#fff}.nf-report{border:1px solid #dbe3ec;border-radius:12px;padding:14px;margin:14px 0;background:#f8fafc}.nf-report label{display:block;font-size:.82rem;font-weight:700;margin:10px 0 5px}.nf-report textarea,.nf-report input[type=file]{box-sizing:border-box;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.nf-report textarea{min-height:100px;resize:vertical}.nf-report small{display:block;color:#64748b;margin-top:5px}.nf-report button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}.nf-report button[type=submit]{background:#0f766e;color:#fff}.nf-report button:disabled{opacity:.55;cursor:wait}.nf-status{font-size:.75rem;color:#475569;margin-top:8px}.nf-evidence{white-space:nowrap}';
  document.head.appendChild(style);
 }
 async function load(){
  const box=document.getElementById('nf-health-body');if(!box||!client())return;
  box.innerHTML='<p>Carregando registros e diagnóstico…</p>';
  const [scans,events]=await Promise.all([client().from('health_scan_runs').select('*').order('started_at',{ascending:false}).limit(10),client().from('app_error_events').select('*').order('occurred_at',{ascending:false}).limit(50)]);
  if(scans.error||events.error){box.innerHTML='<p style="color:#b91c1c">Falha ao carregar: '+esc(scans.error?.message||events.error?.message)+'</p>';return;}
  const errors=events.data||[],open=errors.filter(e=>!['resolved','ignored','auto_fixed'].includes(e.status)),last=scans.data?.[0];
  const evidence=await Promise.all(errors.map(async e=>{const path=e.technical_details?.screenshot_path;if(!path)return '';try{const {data,error}=await client().storage.from(BUCKET).createSignedUrl(path,3600);return error||!data?.signedUrl?'':`<a target="_blank" rel="noopener" href="${esc(data.signedUrl)}">Ver print</a>`;}catch(_){return '';}}));
  const corrected=errors.filter(e=>['resolved','auto_fixed'].includes(e.status));
  box.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:10px"><div class="card"><b>Status da varredura</b><br>${esc(last?.status||'Aguardando')}</div><div class="card"><b>Erros em aberto</b><br>${open.length}</div><div class="card"><b>Última varredura</b><br>${last?new Date(last.started_at).toLocaleString('pt-BR'):'Não executada'}</div></div>
   <section class="nf-report"><h3 style="margin:0 0 5px">Registrar erro para análise</h3><p style="margin:0;color:#64748b;font-size:.82rem">Descreva o erro, anexe uma captura de tela ou envie os dois. O relato ficará disponível neste painel para análise posterior.</p><form id="nf-error-report-form"><label for="nf-error-description">Descrição do erro</label><textarea id="nf-error-description" maxlength="1200" placeholder="Informe o que você tentou fazer e qual mensagem ou comportamento apareceu."></textarea><label for="nf-error-image">Captura de tela (opcional)</label><input id="nf-error-image" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG ou WebP; máximo de 8 MB. Evite incluir senhas ou dados pessoais na imagem.</small><div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button type="submit">Enviar relato</button><span id="nf-error-report-status" class="nf-status" role="status"></span></div></form></section>
   <h3>Erros e relatos recentes</h3><div style="overflow:auto"><table><thead><tr><th>Data</th><th>Gravidade</th><th>Tipo</th><th>Descrição / mensagem</th><th>Print</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${errors.map((e,i)=>`<tr><td>${new Date(e.occurred_at).toLocaleString('pt-BR')}</td><td>${esc(e.severity)}</td><td>${esc(e.error_type)}</td><td>${esc(e.message)}${e.suggested_fix?'<br><small>Correção sugerida: '+esc(e.suggested_fix)+'</small>':''}${e.technical_details?.url?'<br><small>'+esc(e.technical_details.url)+'</small>':''}</td><td class="nf-evidence">${evidence[i]||'—'}</td><td>${esc(e.status)}</td><td>${!['resolved','ignored','auto_fixed'].includes(e.status)?`<button type="button" data-resolve="${esc(e.id)}">Registrar correção</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="7">Nenhum erro registrado.</td></tr>'}</tbody></table></div>
   <h3>Correções realizadas</h3><div style="overflow:auto"><table><thead><tr><th>Data da correção</th><th>Erro</th><th>Correção registrada</th></tr></thead><tbody>${corrected.map(e=>`<tr><td>${e.resolved_at?new Date(e.resolved_at).toLocaleString('pt-BR'):'—'}</td><td>${esc(e.message)}</td><td>${esc(e.resolution||e.suggested_fix||'Correção registrada')}</td></tr>`).join('')||'<tr><td colspan="3">Nenhuma correção registrada ainda.</td></tr>'}</tbody></table></div>`;
  document.getElementById('nf-error-report-form')?.addEventListener('submit',submitReport);
  box.querySelectorAll('[data-resolve]').forEach(button=>button.addEventListener('click',()=>resolveError(button.dataset.resolve)));
 }
 async function resolveError(id){const resolution=prompt('Descreva a correção aplicada e como foi confirmada:');if(!resolution?.trim())return;const {error}=await client().from('app_error_events').update({status:'resolved',resolution:resolution.trim().slice(0,2000),resolved_at:new Date().toISOString(),resolved_by:profile()?.id}).eq('id',id);if(error){alert('Não foi possível registrar a correção: '+error.message);return;}await load();}
 async function submitReport(event){
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),status=document.getElementById('nf-error-report-status'),description=document.getElementById('nf-error-description'),fileInput=document.getElementById('nf-error-image'),file=fileInput?.files?.[0];
  if(!client()||!profile()?.id){status.textContent='Sessão não encontrada. Entre novamente e tente de novo.';return;}
  if(!description.value.trim()&&!file){status.textContent='Descreva o erro ou anexe uma captura de tela.';return;}
  if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)){status.textContent='Escolha uma imagem PNG, JPG ou WebP de até 8 MB.';return;}
  button.disabled=true;status.textContent='Salvando relato…';let path='';
  try{
   if(file){const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';path=`${profile().id}/relatos-erro/${crypto.randomUUID()}.${ext}`;const uploaded=await client().storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)throw uploaded.error;}
   const details={url:location.href,userAgent:navigator.userAgent,report_type:'manual',screenshot_path:path||null,screenshot_name:file?.name||null};
   const {error}=await client().from('app_error_events').insert({user_id:profile().id,source:'manual_report',screen:location.hash||location.pathname,action:'relatar_erro',error_type:'manual_report',severity:'medium',message:(description.value.trim()||'Captura de tela enviada para análise.').slice(0,1200),technical_details:details});
   if(error)throw error;
   form.reset();status.textContent='Relato registrado. Ele já aparece na lista para análise.';await load();
  }catch(error){if(path)await client().storage.from(BUCKET).remove([path]).catch(()=>{});status.textContent='Não foi possível registrar: '+String(error?.message||error);}
  finally{const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=false;}
 }
 async function scan(){const button=document.getElementById('nf-health-scan');button.disabled=true;try{const result=await client().rpc('run_nexofield_health_scan',{p_trigger_type:'manual'});if(result.error)throw result.error;await load();}catch(error){record({source:'health_panel',action:'run_scan',message:error.message,stack:error.stack});alert('Falha na varredura: '+error.message);}finally{button.disabled=false;}}
 function mount(){
  if(profile()?.tipo!=='admin'||document.getElementById('nf-health-button'))return;
  css();document.body.insertAdjacentHTML('beforeend','<button id="nf-health-button" aria-label="Abrir relatos de erro e painel de saúde do sistema">🩺 Erros e saúde do sistema</button><div id="nf-health-modal" hidden><section id="nf-health-card"><div style="display:flex;justify-content:space-between;align-items:center"><h2>Saúde do NexoField</h2><button id="nf-health-x" type="button">Fechar</button></div><div class="nf-ha"><button id="nf-health-scan" class="nf-hp" type="button">Executar varredura agora</button><button id="nf-health-refresh" type="button">Atualizar painel</button></div><div id="nf-health-body"></div></section></div>');
  const modal=document.getElementById('nf-health-modal');document.getElementById('nf-health-button').onclick=()=>{modal.hidden=false;load();};document.getElementById('nf-health-x').onclick=()=>modal.hidden=true;document.getElementById('nf-health-refresh').onclick=load;document.getElementById('nf-health-scan').onclick=scan;
 }
 async function daily(){if(profile()?.tipo!=='admin'||!client())return;const key='nf-health-last-daily-v1',last=Number(localStorage.getItem(key)||0);if(Date.now()-last<86400000)return;localStorage.setItem(key,String(Date.now()));const result=await client().rpc('run_nexofield_health_scan',{p_trigger_type:'scheduled'});if(result.error){localStorage.removeItem(key);record({source:'health_daily',action:'scheduled_scan',message:result.error.message});}}
 setInterval(()=>{mount();daily();},1500);document.addEventListener('DOMContentLoaded',()=>{mount();daily();});root.NexoFieldHealth={record,load,scan,mount,daily};
})(window);
