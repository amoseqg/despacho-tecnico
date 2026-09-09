(function(){
  'use strict';
  const SUPABASE_URL='https://hxbuoqxojwpsreakmfdc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_8TfOJdgLoppVWJWjpfQwkw_bzIFuRyW';
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'nexofield-portal-abertura-auth'},
    db:{schema:'public'}
  });
  const $=id=>document.getElementById(id);
  let solicitante=null,sites=[],siteSelecionado=null,temporizadorBusca=null;

  function texto(v){return String(v??'').trim();}
  function normalizar(v){return texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function numero(v){return (texto(v).match(/\d+/g)||[]).join('');}
  function dataLocal(v){return v?new Date(v).toLocaleString('pt-BR'):'—';}
  function escapar(v){const d=document.createElement('div');d.textContent=texto(v);return d.innerHTML;}
  function status(el,mensagem,ok=false){el.textContent=mensagem||'';el.classList.toggle('ok',!!ok);}
  function bloquear(botao,bloqueado,rotulo){if(!botao)return;botao.disabled=bloqueado;if(rotulo)botao.textContent=rotulo;}

  function mostrarLogin(mensagem=''){
    $('tela-login').classList.remove('oculto');$('tela-portal').classList.add('oculto');$('btn-sair').classList.add('oculto');
    status($('login-status'),mensagem);
  }
  function mostrarPortal(){
    $('tela-login').classList.add('oculto');$('tela-portal').classList.remove('oculto');$('btn-sair').classList.remove('oculto');
    $('nome-solicitante').textContent=solicitante.nome;$('email-solicitante').textContent=solicitante.email;$('aberto-por').value=solicitante.nome;
    atualizarDataAbertura();definirVencimentoInicial();
  }
  function atualizarDataAbertura(){$('data-abertura').value=new Date().toLocaleString('pt-BR');}
  function definirVencimentoInicial(){if($('vencimento').value)return;const d=new Date(Date.now()+5*60*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$('vencimento').value=d.toISOString().slice(0,16);}

  async function validarAcesso(){
    const {data:{user},error:userError}=await sb.auth.getUser();
    if(userError||!user){mostrarLogin();return false;}
    const {data,error}=await sb.from('solicitantes_chamados').select('id,user_id,nome,email,ativo').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!data?.ativo){await sb.auth.signOut();mostrarLogin('Este e-mail não está autorizado para abrir chamados. Procure um administrador do NexoField.');return false;}
    solicitante=data;mostrarPortal();await Promise.all([carregarSites(),carregarChamados()]);return true;
  }

  async function carregarSites(){
    const todas=[];const tamanho=1000;
    for(let inicio=0;;inicio+=tamanho){
      const {data,error}=await sb.from('sites').select('id,circuito,site,cidade,endereco,contato,horario_expediente').eq('ativo',true).order('circuito').range(inicio,inicio+tamanho-1);
      if(error)throw error;todas.push(...(data||[]));if(!data||data.length<tamanho)break;
    }
    sites=todas;$('lista-circuitos').innerHTML=sites.map(s=>`<option value="${escapar(s.circuito)}">${escapar(s.site)} — ${escapar(s.cidade)}</option>`).join('');
    const msg=sites.length?'Digite o circuito completo ou somente a parte numérica.':'A base de circuitos ainda está sendo sincronizada pelo administrador.';
    $('circuito-status').textContent=msg;$('circuito-status').className=sites.length?'ajuda':'ajuda erro';
  }

  function limparSite(){siteSelecionado=null;['cliente','cidade','endereco','horario'].forEach(id=>$(id).value='');}
  function escolherSite(site){
    siteSelecionado=site;$('circuito').value=site.circuito;$('cliente').value=site.site||'';$('cidade').value=site.cidade||'';$('endereco').value=site.endereco||'';$('horario').value=site.horario_expediente||'';
    if(!$('contato').value)$('contato').value=site.contato||'';$('circuito-status').textContent='Circuito encontrado. Os dados do local foram preenchidos automaticamente.';$('circuito-status').className='ajuda ok';
  }
  function buscarCircuito(){
    const busca=texto($('circuito').value);if(!busca){limparSite();$('circuito-status').textContent='Digite o circuito completo ou somente a parte numérica.';$('circuito-status').className='ajuda';return;}
    const chave=normalizar(busca),n=numero(busca);const exato=sites.find(s=>normalizar(s.circuito)===chave);if(exato){escolherSite(exato);return;}
    const candidatos=n?sites.filter(s=>numero(s.circuito)===n):[];if(candidatos.length===1){escolherSite(candidatos[0]);return;}
    limparSite();$('circuito-status').textContent=candidatos.length>1?'Há mais de um circuito com esse número. Digite também as letras iniciais.':'Circuito não encontrado na base do NexoField.';$('circuito-status').className='ajuda erro';
  }

  async function entrar(evento){
    evento.preventDefault();const botao=evento.submitter;bloquear(botao,true,'Entrando...');status($('login-status'),'');
    try{const {error}=await sb.auth.signInWithPassword({email:texto($('login-email').value).toLowerCase(),password:$('login-senha').value});if(error)throw error;await validarAcesso();}
    catch(e){status($('login-status'),e.message==='Invalid login credentials'?'E-mail ou senha inválidos.':e.message);}
    finally{bloquear(botao,false,'Entrar');}
  }
  async function recuperar(){const email=texto($('login-email').value).toLowerCase();if(!email){status($('login-status'),'Digite seu e-mail primeiro.');return;}const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/abrir-chamado.html'});status($('login-status'),error?error.message:'Link de redefinição enviado para o e-mail informado.',!error);}
  async function salvarNovaSenha(evento){
    evento.preventDefault();const senha=$('nova-senha').value,confirmacao=$('nova-senha-confirmacao').value,botao=evento.submitter;
    if(senha.length<6){status($('senha-status'),'A senha deve ter pelo menos 6 caracteres.');return;}
    if(senha!==confirmacao){status($('senha-status'),'A confirmação da senha não confere.');return;}
    bloquear(botao,true,'Salvando...');const {error}=await sb.auth.updateUser({password:senha});
    if(error){status($('senha-status'),error.message);bloquear(botao,false,'Salvar nova senha');return;}
    $('form-nova-senha').classList.add('oculto');$('form-login').classList.remove('oculto');status($('login-status'),'Senha alterada. Você já pode entrar no portal.',true);bloquear(botao,false,'Salvar nova senha');
  }
  async function sair(){await sb.auth.signOut();solicitante=null;sites=[];mostrarLogin();}

  async function abrirChamado(evento){
    evento.preventDefault();const botao=$('btn-enviar');status($('chamado-status'),'');buscarCircuito();
    if(!siteSelecionado){status($('chamado-status'),'Selecione um circuito válido antes de enviar.');$('circuito').focus();return;}
    const vencimento=new Date($('vencimento').value);if(!Number.isFinite(vencimento.getTime())||vencimento<=new Date()){status($('chamado-status'),'Informe um vencimento futuro.');return;}
    bloquear(botao,true,'Enviando...');
    try{
      const linha={protocolo:'GERADO-AUTOMATICAMENTE',sdm:texto($('sdm').value),site_id:siteSelecionado.id,circuito:siteSelecionado.circuito,site_nome:siteSelecionado.site||null,cidade:siteSelecionado.cidade||null,endereco:siteSelecionado.endereco||null,contato:texto($('contato').value),horario_expediente:siteSelecionado.horario_expediente||null,regiao:'interior',skill:'voz',descricao:texto($('observacoes').value)||null,status:'aberto',solicitante_id:solicitante.user_id,vencimento_em:vencimento.toISOString()};
      const {data,error}=await sb.from('chamados').insert(linha).select('id,protocolo,status,criado_em,vencimento_em').single();if(error)throw error;
      $('protocolo-gerado').textContent=data.protocolo;$('confirmacao').showModal();$('form-chamado').reset();siteSelecionado=null;['cliente','cidade','endereco','horario'].forEach(id=>$(id).value='');$('aberto-por').value=solicitante.nome;atualizarDataAbertura();definirVencimentoInicial();buscarCircuito();await carregarChamados();
    }catch(e){status($('chamado-status'),'Não foi possível abrir o chamado: '+e.message);}
    finally{bloquear(botao,false,'Abrir chamado');}
  }

  async function carregarChamados(){
    const {data,error}=await sb.from('chamados').select('id,protocolo,sdm,circuito,site_nome,status,criado_em,vencimento_em').eq('solicitante_id',solicitante.user_id).order('criado_em',{ascending:false}).limit(50);
    if(error)throw error;const box=$('lista-chamados');if(!data?.length){box.innerHTML='<div class="vazio">Você ainda não abriu chamados.</div>';return;}
    const nomes={aberto:'Aberto',pendente:'Distribuído',andamento:'Em atendimento',recusado:'Recusado',concluida:'Concluído',cancelado:'Cancelado'};
    box.innerHTML=data.map(c=>`<article class="item ${escapar(c.status)}"><div class="item-topo"><strong>${escapar(c.protocolo)}</strong><span class="badge">${escapar(nomes[c.status]||c.status)}</span></div><p><b>SDM:</b> ${escapar(c.sdm||'—')}<br><b>Circuito:</b> ${escapar(c.circuito)}<br><b>Cliente:</b> ${escapar(c.site_nome||'—')}<br><b>Abertura:</b> ${escapar(dataLocal(c.criado_em))}<br><b>Vencimento:</b> ${escapar(dataLocal(c.vencimento_em))}</p></article>`).join('');
  }

  $('form-login').addEventListener('submit',entrar);$('form-nova-senha').addEventListener('submit',salvarNovaSenha);$('btn-recuperar').addEventListener('click',recuperar);$('btn-sair').addEventListener('click',sair);$('form-chamado').addEventListener('submit',abrirChamado);$('btn-atualizar').addEventListener('click',()=>carregarChamados().catch(e=>status($('chamado-status'),e.message)));$('btn-fechar-confirmacao').addEventListener('click',()=>$('confirmacao').close());
  $('circuito').addEventListener('input',()=>{clearTimeout(temporizadorBusca);temporizadorBusca=setTimeout(buscarCircuito,160);});$('circuito').addEventListener('change',buscarCircuito);
  sb.auth.onAuthStateChange(evento=>{if(evento==='PASSWORD_RECOVERY'){$('tela-login').classList.remove('oculto');$('tela-portal').classList.add('oculto');$('form-login').classList.add('oculto');$('form-nova-senha').classList.remove('oculto');}});
  validarAcesso().catch(e=>mostrarLogin('Não foi possível carregar o portal: '+e.message));
})();
