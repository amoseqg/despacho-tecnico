(function(){
  'use strict';
  const areas=[['card-tec','tec','👷','Área do Técnico'],['card-adm','adm','🛡️','Área Administrador'],['card-log','log','🚚','Área Logística']];
  function abrir(tipo,icone,titulo){
    try{if(typeof showLogin==='function'){showLogin(tipo);return;}}catch(error){console.error('Falha ao abrir a área selecionada:',error);}
    try{if(typeof window.showLogin==='function'){window.showLogin(tipo);return;}}catch(error){console.error('Falha ao abrir a área selecionada:',error);}
    const home=document.getElementById('t0'),login=document.getElementById('t1');
    if(home)home.classList.add('hidden');if(login)login.classList.remove('hidden');
    try{loginType=tipo;}catch(_){}
    const i=document.getElementById('li'),t=document.getElementById('lt'),s=document.getElementById('ls');
    if(i)i.textContent=icone;if(t)t.textContent=titulo;if(s)s.textContent='Use seu e-mail e senha';
    const user=document.getElementById('lu'),pass=document.getElementById('lp');
    if(user){user.value='';user.type='email';user.placeholder='E-mail';}
    if(pass)pass.value='';
  }
  function voltar(){
    try{if(typeof goHome==='function'){goHome();return;}}catch(error){console.error('Falha ao voltar à tela inicial:',error);}
    try{if(typeof window.goHome==='function'){window.goHome();return;}}catch(error){console.error('Falha ao voltar à tela inicial:',error);}
    document.getElementById('t1')?.classList.add('hidden');
    document.getElementById('pa')?.classList.add('hidden');
    document.getElementById('pt')?.classList.add('hidden');
    document.getElementById('plog')?.classList.add('hidden');
    document.getElementById('t0')?.classList.remove('hidden');
  }
  function entrar(){
    try{if(typeof doLogin==='function'){doLogin();return;}}catch(error){console.error('Falha ao entrar no portal:',error);}
    try{if(typeof window.doLogin==='function'){window.doLogin();return;}}catch(error){console.error('Falha ao entrar no portal:',error);}
    const erro=document.getElementById('le');if(erro){erro.textContent='O acesso não carregou corretamente. Atualize a página e tente novamente.';erro.style.display='block';}
  }
  function ligar(){
    areas.forEach(([id,tipo,icone,titulo])=>{
      const card=document.getElementById(id);if(!card||card.dataset.nfAreaBound==='1')return;
      card.dataset.nfAreaBound='1';
      card.addEventListener('click',()=>abrir(tipo,icone,titulo));
      card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();abrir(tipo,icone,titulo);}});
    });
    const back=document.getElementById('btn-voltar');
    if(back&&back.dataset.nfBackBound!=='1'){back.dataset.nfBackBound='1';back.addEventListener('click',event=>{event.stopImmediatePropagation();voltar();},true);}
    const login=document.getElementById('btn-login');
    if(login&&login.dataset.nfLoginBound!=='1'){login.dataset.nfLoginBound='1';login.addEventListener('click',event=>{event.stopImmediatePropagation();entrar();},true);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ligar,{once:true});else ligar();
})();
