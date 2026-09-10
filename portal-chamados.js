(function(){
  'use strict';
  const SUPABASE_URL='https://hxbuoqxojwpsreakmfdc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_8TfOJdgLoppVWJWjpfQwkw_bzIFuRyW';
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:'nexofield-portal-abertura-auth'},
    db:{schema:'public'}
  });
  const $=id=>document.getElementById(id);
  let solicitante=null,sites=[],siteSelecionado=null,temporizadorBusca=null,modoNovoCircuito=false,chamadosRelatorio=[];

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
    const operadoras={vectra:'Vectra',um_telecom:'UM Telecom',metodo:'Método'};$('nome-solicitante').textContent=solicitante.nome;$('email-solicitante').textContent=solicitante.email+' • '+(operadoras[solicitante.operadora]||'Operadora não definida');$('aberto-por').value=solicitante.nome;
    atualizarDataAbertura();definirVencimentoInicial();
  }
  function atualizarDataAbertura(){$('data-abertura').value=new Date().toLocaleString('pt-BR');}
  function regiaoDoSite(site){return ['NORTE','SUL','LESTE','OESTE'].includes(texto(site?.regiao_operacional).toUpperCase())?'capital':'interior';}
  function definirVencimentoInicial(site=siteSelecionado){const horas=regiaoDoSite(site)==='capital'?6:8,d=new Date(Date.now()+horas*60*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$('vencimento').value=d.toISOString().slice(0,16);$('vencimento').title=`SLA automático: ${horas} horas (${horas===6?'Capital':'Interior'})`;}

  async function validarAcesso(){
    const {data:{user},error:userError}=await sb.auth.getUser();
    if(userError||!user){mostrarLogin();return false;}
    const {data,error}=await sb.from('solicitantes_chamados').select('id,user_id,nome,email,operadora,ativo').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!data?.ativo){await sb.auth.signOut();mostrarLogin('Este e-mail não está autorizado para abrir chamados. Procure um administrador do NexoField.');return false;}
    solicitante=data;mostrarPortal();await Promise.all([carregarSites(),carregarChamados()]);return true;
  }

  async function carregarSites(){
    const todas=[];const tamanho=1000;
    for(let inicio=0;;inicio+=tamanho){
      const {data,error}=await sb.from('sites').select('id,circuito,site,cidade,endereco,contato,horario_expediente,regiao_operacional').eq('ativo',true).order('circuito').range(inicio,inicio+tamanho-1);
      if(error)throw error;todas.push(...(data||[]));if(!data||data.length<tamanho)break;
    }
    sites=todas;$('lista-circuitos').innerHTML=sites.map(s=>`<option value="${escapar(s.circuito)}">${escapar(s.site)} — ${escapar(s.cidade)}</option>`).join('');
    const msg=sites.length?'Digite o circuito completo ou somente a parte numérica.':'A base de circuitos ainda está sendo sincronizada pelo administrador.';
    $('circuito-status').textContent=msg;$('circuito-status').className=sites.length?'ajuda':'ajuda erro';
  }

  function limparSite(){siteSelecionado=null;['cliente','cidade','endereco','horario'].forEach(id=>$(id).value='');}
  function definirModoNovoCircuito(ativo){
    modoNovoCircuito=ativo;siteSelecionado=null;
    ['cliente','cidade','endereco','horario'].forEach(id=>{$(id).readOnly=!ativo;if(!ativo)$(id).value='';});
    $('dados-site')?.classList.toggle('modo-cadastro',ativo);
    $('novo-circuito-aviso').classList.toggle('oculto',!ativo);$('salvar-circuito-acoes').classList.toggle('oculto',!ativo);$('btn-cancelar-circuito').classList.toggle('oculto',!ativo);$('btn-novo-circuito').classList.toggle('oculto',ativo);
    $('circuito-status').textContent=ativo?'Informe um número de circuito que ainda não esteja cadastrado.':'Digite o circuito completo ou somente a parte numérica.';$('circuito-status').className='ajuda';
    if(ativo)$('circuito').focus();
  }
  function escolherSite(site){
    modoNovoCircuito=false;siteSelecionado=site;['cliente','cidade','endereco','horario'].forEach(id=>$(id).readOnly=true);$('dados-site')?.classList.remove('modo-cadastro');$('novo-circuito-aviso').classList.add('oculto');$('salvar-circuito-acoes').classList.add('oculto');$('btn-cancelar-circuito').classList.add('oculto');$('btn-novo-circuito').classList.remove('oculto');$('circuito').value=site.circuito;$('cliente').value=site.site||'';$('cidade').value=site.cidade||'';$('endereco').value=site.endereco||'';$('horario').value=site.horario_expediente||'';
    if(!$('contato').value)$('contato').value=site.contato||'';definirVencimentoInicial(site);$('circuito-status').textContent=`Circuito encontrado. SLA aplicado: ${regiaoDoSite(site)==='capital'?'Capital — 6 horas':'Interior — 8 horas'}.`;$('circuito-status').className='ajuda ok';
  }
  function buscarCircuito(){
    if(modoNovoCircuito)return;
    const busca=texto($('circuito').value);if(!busca){limparSite();$('circuito-status').textContent='Digite o circuito completo ou somente a parte numérica.';$('circuito-status').className='ajuda';return;}
    const chave=normalizar(busca),n=numero(busca);const exato=sites.find(s=>normalizar(s.circuito)===chave);if(exato){escolherSite(exato);return;}
    const candidatos=n?sites.filter(s=>numero(s.circuito)===n):[];if(candidatos.length===1){escolherSite(candidatos[0]);return;}
    limparSite();$('circuito-status').textContent=candidatos.length>1?'Há mais de um circuito com esse número. Digite também as letras iniciais.':'Circuito não encontrado na base do NexoField.';$('circuito-status').className='ajuda erro';
  }

  async function salvarNovoCircuito(){
    const circuito=texto($('circuito').value),cliente=texto($('cliente').value),cidade=texto($('cidade').value),endereco=texto($('endereco').value),horario=texto($('horario').value),contato=texto($('contato').value),botao=$('btn-salvar-circuito');
    if(!circuito||!cliente||!cidade||!endereco||!horario||!contato){status($('chamado-status'),'Preencha circuito, cliente, cidade, endereço, horário e contato.');return;}
    const existente=sites.find(s=>normalizar(s.circuito)===normalizar(circuito));if(existente){escolherSite(existente);status($('chamado-status'),'Este circuito já existia e foi selecionado.',true);return;}
    bloquear(botao,true,'Salvando...');status($('chamado-status'),'');
    try{
      const linha={circuito,site:cliente,cidade,endereco,contato,horario_expediente:horario,ativo:true,cadastrado_por_solicitante:solicitante.user_id};
      const {data,error}=await sb.from('sites').insert(linha).select('id,circuito,site,cidade,endereco,contato,horario_expediente,regiao_operacional').single();if(error)throw error;
      sites.push(data);escolherSite(data);status($('chamado-status'),'Novo circuito salvo e selecionado. Agora você pode abrir o chamado.',true);
    }catch(e){status($('chamado-status'),e.code==='23505'?'Este número de circuito já está cadastrado.':'Não foi possível salvar o circuito: '+e.message);}
    finally{bloquear(botao,false,'Salvar novo circuito');}
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
    definirVencimentoInicial(siteSelecionado);const vencimento=new Date($('vencimento').value);if(!Number.isFinite(vencimento.getTime())||vencimento<=new Date()){status($('chamado-status'),'Não foi possível calcular o SLA do chamado.');return;}
    bloquear(botao,true,'Enviando...');
    try{
      const linha={protocolo:'GERADO-AUTOMATICAMENTE',sdm:texto($('sdm').value),site_id:siteSelecionado.id,circuito:siteSelecionado.circuito,site_nome:siteSelecionado.site||null,cidade:siteSelecionado.cidade||null,endereco:siteSelecionado.endereco||null,contato:texto($('contato').value),horario_expediente:siteSelecionado.horario_expediente||null,regiao:regiaoDoSite(siteSelecionado),skill:'voz',descricao:texto($('observacoes').value)||null,status:'aberto',solicitante_id:solicitante.user_id,vencimento_em:vencimento.toISOString()};
      const {data,error}=await sb.from('chamados').insert(linha).select('id,protocolo,status,criado_em,vencimento_em').single();if(error)throw error;
      $('protocolo-gerado').textContent=data.protocolo;$('confirmacao').showModal();$('form-chamado').reset();definirModoNovoCircuito(false);$('aberto-por').value=solicitante.nome;atualizarDataAbertura();definirVencimentoInicial();buscarCircuito();await carregarChamados();
    }catch(e){status($('chamado-status'),'Não foi possível abrir o chamado: '+e.message);}
    finally{bloquear(botao,false,'Abrir chamado');}
  }

  const motivosPendencia={pedido_cliente:'A pedido do cliente',local_fechado:'Local fechado',feriado:'Feriado',fortes_chuvas:'Fortes chuvas',falta_energia:'Falta de energia',horario_expediente:'Horário de expediente'};
  function renderPendencia(c){
    const p=c.pendencia,ativa=p&&['solicitada','aprovada'].includes(p.status),podeSolicitar=['aberto','pendente','andamento'].includes(c.status)&&!ativa;
    const titulo=p?.origem==='tecnico'?'Solicitação de pendência recebida do técnico':'Pendência';
    const detalhe=p?`<div class="pendencia-resumo ${p.status}"><div class="item-topo"><strong>${titulo}</strong><span class="badge ${p.status==='aprovada'?'validado':p.status==='rejeitada'?'nao-validado':'aguardando'}">${p.status==='solicitada'?'Aguardando decisão':p.status==='aprovada'?'Autorizada':p.status==='rejeitada'?'Não autorizada':'Finalizada'}</span></div><p><b>Solicitado por:</b> ${escapar(p.solicitado_por_nome)} (${p.origem==='tecnico'?'Técnico':'Operador'})<br><b>Situação informada:</b> ${escapar(motivosPendencia[p.motivo]||p.motivo)}</p><div class="mensagem-tecnico"><b>Mensagem recebida do técnico</b><p>${escapar(p.mensagem)}</p></div><p><b>Novo prazo solicitado:</b> ${escapar(dataLocal(p.aprazado_para))}<br><b>Saída programada solicitada:</b> ${escapar(dataLocal(p.saida_programada_em))}${p.decisao_mensagem?`<br><b>Motivo da decisão:</b> ${escapar(p.decisao_mensagem)}`:''}</p>${p.status==='solicitada'?`<div class="decisao-pendencia"><button type="button" class="botao botao-primario btn-decidir-pendencia" data-id="${p.id}" data-decisao="aprovada">Pendenciar chamado</button><button type="button" class="botao botao-perigo btn-abrir-nao-pendenciar" data-id="${p.id}">Não pendenciar chamado</button></div><div class="form-nao-pendenciar oculto" data-id="${p.id}"><label>Motivo do não pendenciamento<textarea class="motivo-nao-pendenciar" data-id="${p.id}" maxlength="2000" rows="3" placeholder="Descreva obrigatoriamente por que o chamado não será pendenciado"></textarea></label><button type="button" class="botao botao-perigo btn-confirmar-nao-pendenciar" data-id="${p.id}">Confirmar não pendenciamento</button></div>`:''}</div>`:'';
    const ultimoNao=c.naoPendenciamento?`<div class="nao-pendenciamento-resumo"><b>Último não pendenciamento</b><br>${escapar(c.naoPendenciamento.motivo)}<br><small>${escapar(c.naoPendenciamento.operador_nome)} • ${escapar(dataLocal(c.naoPendenciamento.criado_em))}</small></div>`:'';
    const formulario=podeSolicitar?`<div class="pendencia-acoes"><button type="button" class="botao botao-claro btn-abrir-pendencia" data-id="${c.id}">Pendenciar chamado</button><button type="button" class="botao botao-perigo btn-abrir-nao-pendenciar-chamado" data-id="${c.id}">Não pendenciar chamado</button></div><div class="form-pendencia oculto" data-id="${c.id}"><label>Situação<select class="pendencia-motivo" data-id="${c.id}"><option value="">Selecione...</option>${Object.entries(motivosPendencia).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label>Novo prazo (aprazamento)<input class="pendencia-aprazamento" data-id="${c.id}" type="datetime-local"></label><label>Saída programada da pendência<input class="pendencia-saida" data-id="${c.id}" type="datetime-local"></label><label>Mensagem<textarea class="pendencia-mensagem" data-id="${c.id}" rows="3" maxlength="2000" placeholder="Descreva a pendência"></textarea></label><button type="button" class="botao botao-primario btn-enviar-pendencia" data-id="${c.id}">Enviar solicitação</button></div><div class="form-nao-pendenciar-chamado oculto" data-id="${c.id}"><label>Motivo do não pendenciamento<textarea class="motivo-nao-pendenciar-chamado" data-id="${c.id}" maxlength="2000" rows="3" placeholder="Descreva obrigatoriamente por que o chamado não será pendenciado"></textarea></label><button type="button" class="botao botao-perigo btn-salvar-nao-pendenciamento" data-id="${c.id}">Salvar motivo</button></div>`:'';
    return `<div class="pendencia-operador">${detalhe}${ultimoNao}${formulario}</div>`;
  }

  async function carregarChamados(){
    const {data,error}=await sb.from('chamados').select('id,protocolo,sdm,circuito,site_nome,operadora,regiao,status,criado_em,vencimento_em').eq('solicitante_id',solicitante.user_id).order('criado_em',{ascending:false}).limit(500);
    if(error)throw error;const box=$('lista-chamados');if(!data?.length){box.innerHTML='<div class="vazio">Você ainda não abriu chamados.</div>';return;}
    const ids=data.map(c=>c.id),[{data:execucoes,error:execErro},{data:validacoes,error:valErro},{data:exclusoes,error:excErro},{data:pendencias,error:penErro},{data:naoPendenciamentos,error:naoPenErro}]=await Promise.all([sb.from('execucoes').select('chamado_id,relatorio_encerramento,enviado_validacao_em').in('chamado_id',ids),sb.from('validacoes_encerramento').select('chamado_id,validacao,senha,resultado,motivo_nao_validacao,validado_em').in('chamado_id',ids),sb.from('exclusoes_chamados_portal').select('chamado_id,excluido_por_nome,excluido_por_email,excluido_em').in('chamado_id',ids),sb.from('solicitacoes_pendencia').select('*').in('chamado_id',ids).order('solicitado_em',{ascending:false}),sb.from('nao_pendenciamentos_chamados').select('*').in('chamado_id',ids).order('criado_em',{ascending:false})]);if(execErro)throw execErro;if(valErro)throw valErro;if(excErro)throw excErro;if(penErro)throw penErro;if(naoPenErro)throw naoPenErro;
    const exMap=new Map((execucoes||[]).map(e=>[e.chamado_id,e])),valMap=new Map((validacoes||[]).map(v=>[v.chamado_id,v])),excMap=new Map((exclusoes||[]).map(v=>[v.chamado_id,v])),penMap=new Map(),naoPenMap=new Map();(pendencias||[]).forEach(p=>{if(!penMap.has(p.chamado_id))penMap.set(p.chamado_id,p);});(naoPendenciamentos||[]).forEach(p=>{if(!naoPenMap.has(p.chamado_id))naoPenMap.set(p.chamado_id,p);});
    const nomes={aberto:'Aberto',pendente:'Distribuído',andamento:'Em atendimento',recusado:'Recusado',concluida:'Concluído',cancelado:'Cancelado'};
    chamadosRelatorio=data.map(c=>({...c,execucao:exMap.get(c.id)||null,validacao:valMap.get(c.id)||null,exclusao:excMap.get(c.id)||null,pendencia:penMap.get(c.id)||null,naoPendenciamento:naoPenMap.get(c.id)||null}));
    const visiveis=chamadosRelatorio.filter(c=>!c.exclusao);if(!visiveis.length){box.innerHTML='<div class="vazio">Nenhum chamado ativo no acompanhamento.</div>';return;}
    box.innerHTML=visiveis.map(c=>{const ex=c.execucao,val=c.validacao,podeDecidir=!!ex?.enviado_validacao_em&&c.status==='andamento',resultado=val?.resultado||'',situacao=resultado==='validado'?'Validado':resultado==='nao_validado'?'Não validado':'Aguardando validação';return `<article class="item ${escapar(c.status)}"><div class="item-topo"><strong>${escapar(c.protocolo)}</strong><span class="badge">${escapar(nomes[c.status]||c.status)}</span></div><p><b>SDM:</b> ${escapar(c.sdm||'—')}<br><b>Circuito:</b> ${escapar(c.circuito)}<br><b>Cliente:</b> ${escapar(c.site_nome||'—')}<br><b>Abertura:</b> ${escapar(dataLocal(c.criado_em))}<br><b>Vencimento:</b> ${escapar(dataLocal(c.vencimento_em))}</p>${ex?.enviado_validacao_em?`<div class="encerramento-operador"><div class="item-topo"><strong>Encerramento recebido do técnico</strong><span class="badge ${resultado==='validado'?'validado':resultado==='nao_validado'?'nao-validado':'aguardando'}">${situacao}</span></div><pre>${escapar(ex.relatorio_encerramento||'Sem informações de encerramento.')}</pre>${podeDecidir?`<label>Resultado<select class="resultado-operador" data-id="${c.id}"><option value="">Selecione...</option><option value="validado" ${resultado==='validado'?'selected':''}>Validado — autorizar encerramento</option><option value="nao_validado" ${resultado==='nao_validado'?'selected':''}>Não validado</option></select></label><div class="campo-senha ${resultado==='validado'?'':'oculto'}" data-id="${c.id}"><label>Senha de encerramento<input class="senha-operador" data-id="${c.id}" maxlength="160" autocomplete="off" placeholder="Informe a senha para autorizar"></label></div><div class="campo-motivo ${resultado==='nao_validado'?'':'oculto'}" data-id="${c.id}"><label>Motivo da não validação<textarea class="motivo-operador" data-id="${c.id}" maxlength="1000" rows="3" placeholder="Descreva o que o técnico precisa corrigir">${escapar(val?.motivo_nao_validacao||'')}</textarea></label></div><button type="button" class="botao botao-primario btn-validar-encerramento" data-id="${c.id}">Salvar decisão</button>`:''}${val?`<p class="${resultado==='validado'?'validacao-ok':'validacao-negada'}"><b>${resultado==='validado'?'✓ Encerramento autorizado':'Não validado'}:</b> ${escapar(dataLocal(val.validado_em))}${resultado==='nao_validado'?`<br><b>Motivo:</b> ${escapar(val.motivo_nao_validacao||'—')}`:''}</p>`:''}</div>`:''}<div class="acoes-item">${c.status!=='concluida'?`<button type="button" class="botao botao-perigo btn-excluir-chamado" data-id="${c.id}">Excluir chamado</button>`:''}</div></article>`;}).join('');
    box.querySelectorAll('.item').forEach((article,i)=>article.querySelector('.acoes-item')?.insertAdjacentHTML('beforebegin',renderPendencia(visiveis[i])));
  }

  function valorDataLocal(data){const d=new Date(data);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
  function prepararFormularioPendencia(chamadoId){
    const c=chamadosRelatorio.find(x=>x.id===chamadoId),form=document.querySelector(`.form-pendencia[data-id="${chamadoId}"]`);if(!c||!form)return;form.classList.toggle('oculto');if(form.classList.contains('oculto'))return;
    const horasSla=c.regiao==='interior'?8:6,agora=Date.now();form.querySelector('.pendencia-saida').value=valorDataLocal(agora+60*60*1000);form.querySelector('.pendencia-aprazamento').value=valorDataLocal(agora+horasSla*60*60*1000);
  }
  async function solicitarPendenciaOperador(chamadoId,botao){
    const pegar=classe=>document.querySelector(`.${classe}[data-id="${chamadoId}"]`),motivo=texto(pegar('pendencia-motivo')?.value),mensagem=texto(pegar('pendencia-mensagem')?.value),aprazamento=new Date(pegar('pendencia-aprazamento')?.value),saida=new Date(pegar('pendencia-saida')?.value);
    if(!motivo||!motivosPendencia[motivo]){status($('chamado-status'),'Selecione uma situação permitida para a pendência.');return;}if(mensagem.length<3){status($('chamado-status'),'Descreva a pendência.');return;}if(!Number.isFinite(aprazamento.getTime())||!Number.isFinite(saida.getTime())||aprazamento<=new Date()||saida<=new Date()){status($('chamado-status'),'O aprazamento e a saída programada precisam estar no futuro.');return;}if(saida>aprazamento){status($('chamado-status'),'A saída programada deve ocorrer antes do novo prazo.');return;}
    bloquear(botao,true,'Enviando...');try{const {error}=await sb.from('solicitacoes_pendencia').insert({chamado_id:chamadoId,solicitante_id:solicitante.user_id,origem:'operador',solicitado_por_nome:solicitante.nome,solicitado_por_email:solicitante.email,motivo,mensagem,aprazado_para:aprazamento.toISOString(),saida_programada_em:saida.toISOString()});if(error)throw error;status($('chamado-status'),'Pendência registrada e aguardando sua autorização.',true);await carregarChamados();}catch(e){status($('chamado-status'),'Não foi possível registrar a pendência: '+e.message);}finally{bloquear(botao,false,'Enviar solicitação');}
  }
  async function decidirPendencia(pendenciaId,decisao,botao){
    let mensagem=null;if(decisao==='rejeitada'){mensagem=texto(document.querySelector(`.motivo-nao-pendenciar[data-id="${pendenciaId}"]`)?.value);if(mensagem.length<3){status($('chamado-status'),'Descreva o motivo do não pendenciamento.');return;}}
    bloquear(botao,true,decisao==='aprovada'?'Pendenciando...':'Registrando...');try{const {error}=await sb.rpc('decidir_pendencia_operador',{p_pendencia_id:pendenciaId,p_decisao:decisao,p_mensagem:mensagem});if(error)throw error;status($('chamado-status'),decisao==='aprovada'?'Chamado pendenciado. O prazo está pausado até a saída programada.':'Chamado não pendenciado; o técnico e o administrador já podem visualizar o motivo.',true);await carregarChamados();}catch(e){status($('chamado-status'),'Não foi possível decidir a pendência: '+e.message);}finally{bloquear(botao,false,decisao==='aprovada'?'Pendenciar chamado':'Confirmar não pendenciamento');}
  }
  async function registrarNaoPendenciamento(chamadoId,botao){
    const motivo=texto(document.querySelector(`.motivo-nao-pendenciar-chamado[data-id="${chamadoId}"]`)?.value);if(motivo.length<3){status($('chamado-status'),'Descreva o motivo do não pendenciamento.');return;}
    bloquear(botao,true,'Salvando...');try{const {error}=await sb.from('nao_pendenciamentos_chamados').insert({chamado_id:chamadoId,operador_id:solicitante.user_id,operador_nome:solicitante.nome,motivo});if(error)throw error;status($('chamado-status'),'Não pendenciamento registrado. O administrador e o técnico já podem visualizar o motivo.',true);await carregarChamados();}catch(e){status($('chamado-status'),'Não foi possível registrar o não pendenciamento: '+e.message);}finally{bloquear(botao,false,'Salvar motivo');}
  }

  async function validarEncerramentoOperador(chamadoId,botao){
    const resultado=texto(document.querySelector(`.resultado-operador[data-id="${chamadoId}"]`)?.value),senha=texto(document.querySelector(`.senha-operador[data-id="${chamadoId}"]`)?.value),motivo=texto(document.querySelector(`.motivo-operador[data-id="${chamadoId}"]`)?.value);if(!resultado){status($('chamado-status'),'Selecione Validado ou Não validado.');return;}if(resultado==='validado'&&!senha){status($('chamado-status'),'Informe a senha para autorizar o encerramento.');return;}if(resultado==='nao_validado'&&motivo.length<3){status($('chamado-status'),'Descreva o motivo da não validação.');return;}
    bloquear(botao,true,'Salvando...');try{const agora=new Date().toISOString(),validacao=`${resultado==='validado'?'Validado':'Não validado'} por ${solicitante.nome}`;const {error}=await sb.from('validacoes_encerramento').upsert({chamado_id:chamadoId,solicitante_id:solicitante.user_id,validacao,resultado,senha:resultado==='validado'?senha:null,motivo_nao_validacao:resultado==='nao_validado'?motivo:null,validado_em:agora,atualizado_em:agora},{onConflict:'chamado_id'});if(error)throw error;status($('chamado-status'),resultado==='validado'?'Encerramento autorizado. O técnico já pode concluir o chamado.':'Não validação enviada ao técnico para correção.',true);await carregarChamados();}catch(e){status($('chamado-status'),'Não foi possível salvar a decisão: '+e.message);}finally{bloquear(botao,false,'Salvar decisão');}
  }

  async function excluirChamado(chamadoId,botao){const chamado=chamadosRelatorio.find(c=>c.id===chamadoId);if(!chamado||!confirm(`Excluir o chamado ${chamado.protocolo}? Ele será cancelado e a exclusão ficará registrada em seu nome.`))return;bloquear(botao,true,'Excluindo...');try{const {error}=await sb.rpc('excluir_chamado_portal',{p_chamado_id:chamadoId});if(error)throw error;status($('chamado-status'),`Chamado ${chamado.protocolo} excluído por ${solicitante.nome}.`,true);await carregarChamados();}catch(e){status($('chamado-status'),'Não foi possível excluir: '+e.message);}finally{bloquear(botao,false,'Excluir chamado');}}
  function exportarValidacoes(){const linhas=chamadosRelatorio.filter(c=>c.validacao).map(c=>{const v=c.validacao,x=c.exclusao;return [c.protocolo,c.sdm||'',c.circuito,c.site_nome||'',v.resultado==='validado'?'Validado':'Não validado',v.motivo_nao_validacao||'',dataLocal(v.validado_em),x?.excluido_por_nome||'',x?dataLocal(x.excluido_em):''];});if(!linhas.length){status($('chamado-status'),'Ainda não existem chamados validados ou não validados para exportar.');return;}const cab=['Protocolo','SDM','Circuito','Cliente','Resultado','Motivo da não validação','Data da decisão','Excluído por','Data da exclusão'],csv='\ufeff'+[cab,...linhas].map(l=>l.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`validacoes_chamados_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  $('form-login').addEventListener('submit',entrar);$('form-nova-senha').addEventListener('submit',salvarNovaSenha);$('btn-recuperar').addEventListener('click',recuperar);$('btn-sair').addEventListener('click',sair);$('form-chamado').addEventListener('submit',abrirChamado);$('btn-atualizar').addEventListener('click',()=>carregarChamados().catch(e=>status($('chamado-status'),e.message)));$('btn-exportar-validacoes').addEventListener('click',exportarValidacoes);$('btn-fechar-confirmacao').addEventListener('click',()=>$('confirmacao').close());$('btn-novo-circuito').addEventListener('click',()=>definirModoNovoCircuito(true));$('btn-cancelar-circuito').addEventListener('click',()=>definirModoNovoCircuito(false));$('btn-salvar-circuito').addEventListener('click',salvarNovoCircuito);
  $('circuito').addEventListener('input',()=>{clearTimeout(temporizadorBusca);temporizadorBusca=setTimeout(buscarCircuito,160);});$('circuito').addEventListener('change',buscarCircuito);
  $('lista-chamados').addEventListener('change',e=>{const select=e.target.closest('.resultado-operador');if(!select)return;const id=select.dataset.id;document.querySelector(`.campo-senha[data-id="${id}"]`)?.classList.toggle('oculto',select.value!=='validado');document.querySelector(`.campo-motivo[data-id="${id}"]`)?.classList.toggle('oculto',select.value!=='nao_validado');});
  $('lista-chamados').addEventListener('click',e=>{const validar=e.target.closest('.btn-validar-encerramento'),excluir=e.target.closest('.btn-excluir-chamado'),abrirPendencia=e.target.closest('.btn-abrir-pendencia'),enviarPendencia=e.target.closest('.btn-enviar-pendencia'),decidir=e.target.closest('.btn-decidir-pendencia'),abrirNaoPendenciar=e.target.closest('.btn-abrir-nao-pendenciar'),confirmarNaoPendenciar=e.target.closest('.btn-confirmar-nao-pendenciar'),abrirNaoPendenciarChamado=e.target.closest('.btn-abrir-nao-pendenciar-chamado'),salvarNaoPendenciamento=e.target.closest('.btn-salvar-nao-pendenciamento');if(validar)validarEncerramentoOperador(validar.dataset.id,validar);if(excluir)excluirChamado(excluir.dataset.id,excluir);if(abrirPendencia)prepararFormularioPendencia(abrirPendencia.dataset.id);if(enviarPendencia)solicitarPendenciaOperador(enviarPendencia.dataset.id,enviarPendencia);if(decidir)decidirPendencia(decidir.dataset.id,decidir.dataset.decisao,decidir);if(abrirNaoPendenciar){const form=document.querySelector(`.form-nao-pendenciar[data-id="${abrirNaoPendenciar.dataset.id}"]`);form?.classList.toggle('oculto');if(form&&!form.classList.contains('oculto'))form.querySelector('textarea')?.focus();}if(confirmarNaoPendenciar)decidirPendencia(confirmarNaoPendenciar.dataset.id,'rejeitada',confirmarNaoPendenciar);if(abrirNaoPendenciarChamado){const form=document.querySelector(`.form-nao-pendenciar-chamado[data-id="${abrirNaoPendenciarChamado.dataset.id}"]`);form?.classList.toggle('oculto');if(form&&!form.classList.contains('oculto'))form.querySelector('textarea')?.focus();}if(salvarNaoPendenciamento)registrarNaoPendenciamento(salvarNaoPendenciamento.dataset.id,salvarNaoPendenciamento);});
  sb.channel('portal-acompanhamento').on('postgres_changes',{event:'*',schema:'public',table:'chamados'},()=>solicitante&&carregarChamados()).on('postgres_changes',{event:'*',schema:'public',table:'execucoes'},()=>solicitante&&carregarChamados()).on('postgres_changes',{event:'*',schema:'public',table:'validacoes_encerramento'},()=>solicitante&&carregarChamados()).on('postgres_changes',{event:'*',schema:'public',table:'exclusoes_chamados_portal'},()=>solicitante&&carregarChamados()).on('postgres_changes',{event:'*',schema:'public',table:'solicitacoes_pendencia'},()=>solicitante&&carregarChamados()).on('postgres_changes',{event:'*',schema:'public',table:'nao_pendenciamentos_chamados'},()=>solicitante&&carregarChamados()).subscribe();
  sb.auth.onAuthStateChange(evento=>{if(evento==='PASSWORD_RECOVERY'){$('tela-login').classList.remove('oculto');$('tela-portal').classList.add('oculto');$('form-login').classList.add('oculto');$('form-nova-senha').classList.remove('oculto');}});
  validarAcesso().catch(e=>mostrarLogin('Não foi possível carregar o portal: '+e.message));
})();
