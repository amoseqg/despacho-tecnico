self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json()||{};}catch{data={};}
 const tag=data.eventId?'nf-chamado-'+data.eventId:'nf-teste-'+Date.now();
 // O mesmo evento entregue novamente substitui o aviso sem tocar novamente.
 await self.registration.showNotification(data.title||'Novo chamado NexoField',{
  body:data.body||'Você recebeu uma nova atividade.',tag,renotify:false,silent:false,
  icon:'/push-icon.svg',badge:'/push-icon.svg',data:{url:data.url||'/'},
 });
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const url=new URL(event.notification.data?.url||'/',self.location.origin);
  if(url.origin!==self.location.origin)return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===url.origin){await client.navigate(url.href);await client.focus();return;}}
  await self.clients.openWindow(url.href);
 })());
});
