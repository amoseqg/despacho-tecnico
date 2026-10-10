import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const origins=new Set(['https://despacho-tecnico.vercel.app']);
const cors=(req:Request)=>({'Access-Control-Allow-Origin':origins.has(req.headers.get('origin')||'')?req.headers.get('origin')!:'https://despacho-tecnico.vercel.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
const validEndpoint=(endpoint:string)=>{try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname);}catch{return false;}};
async function send(subscription:any,payload:any,config:any){
 if(!validEndpoint(subscription.endpoint))throw new Error('Endpoint não permitido');
 const details=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:3600,urgency:'high',vapidDetails:{subject:'mailto:amosenriqueqg@gmail.com',publicKey:config.publicKey,privateKey:config.privateKey}});
 const r=await fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,signal:AbortSignal.timeout(12000)});
 if(r.status===404||r.status===410){await db.from('tecnico_push_subscriptions').delete().eq('endpoint',subscription.endpoint);return 'expired';}
 if(!r.ok)throw new Error('Provedor push: '+r.status);
 return 'sent';
}
Deno.serve(async(req:Request)=>{
 const headers={...cors(req),'Content-Type':'application/json'};
 const response=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'Método inválido'});
 try{
  const {data:config,error:configError}=await db.rpc('nf_push_config');if(configError||!config)throw new Error('Configuração indisponível');
  const internal=req.headers.get('x-nf-push-token')===config.hookToken;
  const input=await req.json();
  let owner:string,payload:any,eventId:string|undefined;
  if(internal){
   const {data:event,error}=await db.rpc('nf_push_claim',{p_id:input.eventId});if(error)throw error;if(!event)return response(200,{skipped:true});
   owner=event.tecnico_id;payload=event.payload;eventId=event.id;
   const {data:ch}=await db.from('chamados').select('tecnico_id,status').eq('id',event.chamado_id).single();
   if(!ch||ch.tecnico_id!==owner||ch.status!=='pendente'){await db.from('tecnico_push_eventos').update({status:'cancelado'}).eq('id',eventId);return response(200,{skipped:true});}
  }else{
   const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
   const {data:auth,error}=await db.auth.getUser(token);if(error||!auth.user)return response(401,{error:'Sessão inválida'});
   const {data:profile}=await db.from('perfis').select('tipo,ativo').eq('id',auth.user.id).single();
   if(profile?.tipo!=='tecnico'||!profile.ativo)return response(403,{error:'Acesso exclusivo do técnico'});
   owner=auth.user.id;payload={title:'Teste de alerta NexoField',body:'Os alertas de novos chamados estão ativados neste celular.',url:'/',test:true};
  }
  const {data:subs,error}=await db.from('tecnico_push_subscriptions').select('subscription').eq('tecnico_id',owner);
  if(error)throw error;
  const selected=internal?subs:(subs||[]).filter(x=>x.subscription.endpoint===input.endpoint);
  const results=await Promise.allSettled((selected||[]).map(x=>send(x.subscription,{...payload,eventId},config)));
  const sent=results.filter(r=>r.status==='fulfilled'&&r.value==='sent').length;
  const failed=results.some(r=>r.status==='rejected');
  if(eventId)await db.from('tecnico_push_eventos').update({status:failed?'erro':'enviado',enviado_em:sent?new Date().toISOString():null,erro:failed?'Falha temporária no provedor':null}).eq('id',eventId);
  if(failed)return response(502,{error:'Falha temporária no envio'});
  return response(200,{sent});
 }catch(error){console.error('Push:',error instanceof Error?error.message:'falha');return response(500,{error:'Não foi possível enviar o alerta. Tente novamente.'});}
});
