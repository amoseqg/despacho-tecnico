(()=>{
 let busy=false,currentUser=null;
 const el=id=>document.getElementById(id);
 const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const status=text=>{if(el('nf-push-status'))el('nf-push-status').textContent=text;};
 async function registration(){return navigator.serviceWorker.register('/tecnico-push-sw.js',{scope:'/'}).then(()=>navigator.serviceWorker.ready);}
 async function refresh(){
  if(!el('nf-push-ativar')||typeof SB_PROFILE==='undefined'||SB_PROFILE?.tipo!=='tecnico')return;
  if(currentUser===SB_PROFILE.id)return;currentUser=SB_PROFILE.id;
  if(!supported()){status('Este navegador não permite alertas em segundo plano. No iPhone, adicione o NexoField à Tela de Início.');return;}
  try{const reg=await registration(),sub=await reg.pushManager.getSubscription();
   const {data,error}=sub?await SB.from('tecnico_push_subscriptions').select('endpoint').eq('endpoint',sub.endpoint).eq('tecnico_id',currentUser).maybeSingle():{data:null};
   if(error)throw error;state(!!data);
  }catch{currentUser=null;status('Não foi possível conferir os alertas. Você pode tentar ativá-los novamente.');}
 }
 function state(active){el('nf-push-ativar').style.display=active?'none':'';el('nf-push-testar').style.display=active?'':'none';el('nf-push-desativar').style.display=active?'':'none';el('nf-push-testar').hidden=!active;el('nf-push-desativar').hidden=!active;status(active?'Alertas ativados neste celular. O som segue as configurações de notificações do aparelho.':'Ative para receber novos chamados mesmo com a página fechada.');}
 async function enable(){
  if(!supported())throw new Error('Use Chrome no Android. No iPhone, adicione o NexoField à Tela de Início e abra pelo ícone.');
  if(typeof SB_PROFILE==='undefined'||SB_PROFILE?.tipo!=='tecnico')throw new Error('Entre com seu perfil técnico.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permita as notificações nas configurações do navegador para ativar os alertas.');
  const {data:key,error}=await SB.rpc('nf_push_public_key');if(error||!key)throw new Error('Não foi possível ativar os alertas. Tente novamente.');
  const reg=await registration();let sub=await reg.pushManager.getSubscription();
  if(!sub){const base=key.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base+'='.repeat((4-base.length%4)%4));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});}
  const {error:save}=await SB.from('tecnico_push_subscriptions').upsert({endpoint:sub.endpoint,tecnico_id:SB_PROFILE.id,subscription:sub.toJSON()},{onConflict:'endpoint'});
  if(save){await sub.unsubscribe();throw new Error('Não foi possível vincular este celular. Tente ativar novamente.');}
  state(true);
 }
 async function disable(){
  if(!supported())return;
  const reg=await registration(),sub=await reg.pushManager.getSubscription();
  if(sub){try{const {error}=await SB.from('tecnico_push_subscriptions').delete().eq('endpoint',sub.endpoint);if(error)throw error;}finally{await sub.unsubscribe();}}
  if(el('nf-push-ativar'))state(false);currentUser=null;
 }
 window.nfDesativarPushAoSair=disable;
 async function test(){
  const reg=await registration(),sub=await reg.pushManager.getSubscription();if(!sub)throw new Error('Ative os alertas primeiro.');
  let {data:{session},error:sessionError}=await SB.auth.getSession();
  if(sessionError||!session?.access_token)throw new Error('Sua sessão expirou. Saia e entre novamente para testar o alerta.');
  const invoke=token=>SB.functions.invoke('tecnico-push',{headers:{Authorization:'Bearer '+token},body:{endpoint:sub.endpoint}});
  let result=await invoke(session.access_token);
  if(result.error?.context?.status===401){
   const refreshed=await SB.auth.refreshSession();
   if(refreshed.error||!refreshed.data.session?.access_token)throw new Error('Sua sessão expirou. Saia e entre novamente para testar o alerta.');
   result=await invoke(refreshed.data.session.access_token);
  }
  const {data,error}=result;
  if(error){if(error.context?.status===401)throw new Error('Sessão não reconhecida. Saia e entre novamente no perfil técnico.');throw new Error('O servidor não conseguiu enviar o alerta de teste. Tente novamente.');}
  if(!data?.sent)throw new Error('Este celular não recebeu o envio. Desative e ative os alertas novamente.');
  status('Teste enviado. Confira a notificação e o volume do celular.');
 }
 document.addEventListener('click',async event=>{
  if(event.target.closest('#nf-push-atalho')){el('nf-push-painel')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const btn=event.target.closest('#nf-push-ativar,#nf-push-testar,#nf-push-desativar');if(!btn||busy)return;
  busy=true;btn.disabled=true;try{await ({'nf-push-ativar':enable,'nf-push-testar':test,'nf-push-desativar':disable}[btn.id])();}catch(error){status(error.message||'Falha ao configurar o alerta.');}finally{busy=false;btn.disabled=false;}
 });
 setInterval(refresh,3000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){currentUser=null;refresh();}});
})();
