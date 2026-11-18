(function(){
'use strict';
const EMAIL='amos.gomes@metodotelecom.com.br';
function adminAutorizado(){
 const perfil=ADMIN_TEC_CONTEXT?.adminProfile||SB_PROFILE;
 const sessao=ADMIN_TEC_CONTEXT?.admin||S;
 return !!(sessao?.t==='adm'&&perfil?.tipo==='admin'&&perfil?.admin_geral===true&&String(perfil?.email||'').trim().toLowerCase()===EMAIL&&String(perfil?.id||'')===String(sessao?._id||''));
}
adminPodeAcessarPerfilTecnico=function(){return adminAutorizado();};
acessarPerfilTecnicoComoAdmin=function(id){
 if(!adminAutorizado()){nfToast('Acesso exclusivo ao Administrador Geral autorizado.','erro');return;}
 if(ADMIN_TEC_CONTEXT){nfToast('Já existe um perfil técnico aberto. Volte ao administrador primeiro.','aviso');return;}
 const tecnico=D.tc.find(t=>String(t._id)===String(id)&&(t.tipo==='tecnico'||t.tecnicoAtivo===true));
 if(!tecnico?._id){nfToast('Técnico ativo não encontrado. Atualize a lista e tente novamente.','erro');return;}
 const perfilAdmin={...SB_PROFILE};
 ADMIN_TEC_CONTEXT={admin:{...S},adminProfile:perfilAdmin,tecnicoId:String(tecnico._id),nome:tecnico.n};
 S={t:'tec',n:tecnico.n,u:tecnico.u,r:tecnico.r,_id:tecnico._id,adminAcessando:true};
 // O JWT permanece autenticado como administrador; o perfil projetado direciona
 // as operações técnicas ao técnico selecionado e mantém o ID dele nos registros.
 SB_PROFILE={...perfilAdmin,...tecnico,id:tecnico._id,usuario:tecnico.u,nome:tecnico.n,tipo:'tecnico'};
 enterTec();
};
voltarAoMeuPerfilAdmin=function(){
 if(!ADMIN_TEC_CONTEXT||!adminAutorizado())return;
 const contexto=ADMIN_TEC_CONTEXT;
 S=contexto.admin;SB_PROFILE=contexto.adminProfile;ADMIN_TEC_CONTEXT=null;
 el('admin-acesso-tecnico-banner')?.remove();enterAdm();
};

const abrirOriginal=rlAbrirChamadosProximoPeriodo;
rlAbrirChamadosProximoPeriodo=function(usuario){
 abrirOriginal(usuario);
 if(!adminAutorizado())return;
 const dialog=Array.from(document.querySelectorAll('dialog')).find(d=>d.open&&d.querySelector('h3')?.textContent.includes('Chamados aprovados do próximo período'));
 if(!dialog||dialog.querySelector('[data-lancamento-manual-pagamento]'))return;
 const tecnico=D.tc.find(t=>t.u===usuario);if(!tecnico?._id)return;
 const area=document.createElement('section');
 area.dataset.lancamentoManualPagamento='1';
 area.style.cssText='margin-top:14px;padding:14px;border:1px solid #c9d9ef;border-radius:12px;background:#f7faff';
 area.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>Lançamento manual para pagamento</b><div style="font-size:.82rem;color:#526273;margin-top:3px">Registre os dados do chamado concluído e o valor aprovado. A data informada define o período de contabilização.</div></div><button type="button" class="btn btn-p" data-abrir-lancamento>＋ Inserir chamado e valor</button></div><form data-form-lancamento hidden style="margin-top:12px"><div class="form-group"><label class="label" for="dados-colados-lancamento">Cole as informações do chamado</label><textarea class="input" id="dados-colados-lancamento" name="dados_colados" rows="4" placeholder="Cole aqui o texto do chamado. Protocolo, cliente, circuito, cidade, skill e descrição serão identificados automaticamente." style="resize:vertical"></textarea><small style="color:#526273">Confira os campos preenchidos e informe o valor a pagar antes de salvar.</small></div><div class="grid-2" style="gap:10px"><div class="form-group"><label class="label">Protocolo *</label><input class="input" name="protocolo" maxlength="100" required></div><div class="form-group"><label class="label">SDM</label><input class="input" name="sdm" maxlength="100"></div><div class="form-group"><label class="label">Site / cliente *</label><input class="input" name="site" maxlength="250" required></div><div class="form-group"><label class="label">Circuito</label><input class="input" name="circuito" maxlength="150"></div><div class="form-group"><label class="label">Cidade</label><input class="input" name="cidade" maxlength="120"></div><div class="form-group"><label class="label">Skill</label><select class="input" name="skill"><option value="voz">Voz</option><option value="dados">Dados</option><option value="wifi">WiFi</option><option value="infra">Infra</option><option value="vistoria">Vistoria</option><option value="vistoria_wifi">Vistoria / WiFi</option><option value="vistoria_voz">Vistoria / Voz</option><option value="dados_vistoria">Dados / Vistoria</option></select></div><div class="form-group"><label class="label">Serviço realizado *</label><input class="input" name="servico" maxlength="200" required placeholder="Ex.: Incidente de voz capital"></div><div class="form-group"><label class="label">Data para contabilização *</label><input class="input" name="data" type="date" required></div><div class="form-group"><label class="label">Valor a pagar (R$) *</label><input class="input" name="valor" type="number" min="0.01" max="1000000" step="0.01" required></div><div class="form-group"><label class="label">Descrição / observação</label><input class="input" name="descricao" maxlength="1000"></div></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" class="btn btn-s" data-cancelar-lancamento>Cancelar</button><button type="submit" class="btn btn-p" data-salvar-lancamento>Salvar lançamento</button></div></form>';
 const heading=dialog.querySelector('h3')?.parentElement?.parentElement;
 if(heading)heading.insertAdjacentElement('afterend',area);else dialog.prepend(area);
 const form=area.querySelector('[data-form-lancamento]');
 const dataInicio=rlProximoPeriodoUtil(RL_DT2_ATUAL,10).inicio||new Date().toISOString().slice(0,10);
 form.elements.data.value=dataInicio;
 const statusAuto=document.createElement('div');statusAuto.style.cssText='margin:0 0 10px;color:#526273;font-size:.82rem';form.prepend(statusAuto);
 let protocoloCarregado='';
 function preencherChamadoPeloProtocolo(){
  const protocolo=String(form.elements.protocolo.value||'').trim().toLocaleLowerCase('pt-BR');
  if(protocolo===protocoloCarregado)return;
  protocoloCarregado=protocolo;
  if(!protocolo){statusAuto.textContent='';return;}
  const encontrados=D.ch.filter(c=>String(c.pr||'').trim().toLocaleLowerCase('pt-BR')===protocolo).sort((a,b)=>new Date(b.cr||0)-new Date(a.cr||0));
  const chamado=encontrados[0];
  if(!chamado){
   statusAuto.textContent='Protocolo não localizado. Você pode preencher os dados manualmente.';
   if(form.dataset.autoFillProtocol){['sdm','site','circuito','cidade','servico','valor','descricao'].forEach(nome=>form.elements[nome].value='');form.elements.data.value=dataInicio;delete form.dataset.autoFillProtocol;}
   return;
  }
  form.dataset.autoFillProtocol=protocolo;
  statusAuto.textContent='Chamado localizado. Dados preenchidos; ao salvar, o protocolo existente será reaproveitado e seu valor/data de pagamento serão atualizados.';
  form.elements.sdm.value=chamado.sdm||'';
  form.elements.site.value=chamado.si||'';
  form.elements.circuito.value=chamado.ci||'';
  form.elements.cidade.value=chamado.cid||'';
  const skillChamado=String(chamado.skill||'dados');
  if(!Array.from(form.elements.skill.options).some(o=>o.value===skillChamado)){const option=document.createElement('option');option.value=skillChamado;option.textContent=nomeSkill(skillChamado);form.elements.skill.append(option);}
  form.elements.skill.value=skillChamado;
  form.elements.servico.value=chamado.ex?.atv||chamado.atividadeServico||'';
  form.elements.data.value=dataBrasilISO(dataPeriodoPagamentoChamado(chamado))||dataInicio;
  const valorExistente=Number(numeroExcel(chamado.ex?.total))||0;
  form.elements.valor.value=valorExistente?valorExistente.toFixed(2):'';
  form.elements.descricao.value=chamado.ex?.relatorio||chamado.ex?.obs||chamado.de||'';
 }
 form.elements.protocolo.addEventListener('input',preencherChamadoPeloProtocolo);
 form.elements.protocolo.addEventListener('change',preencherChamadoPeloProtocolo);
 const campoColado=form.elements.dados_colados;
 function extrairCampoColado(texto,rotulos){
  const rotulo=rotulos.join('|');
  const re=new RegExp('(?:^|\\s)(?:'+rotulo+')\\s*[:：-]\\s*([\\s\\S]*?)(?=\\s+(?:PROTOCOLO|SDM|CIRCUITO|CLIENTE|SITE(?:\\s*\\/\\s*CLIENTE)?|CIDADE|SKILL(?:\\s*NECESSARIA)?|A?REA|SERVICO(?:\\s*REALIZADO)?|DATA|VALOR|DESCRI(?:C|Ç)(?:AO|ÃO)|ENDERECO)\\s*[:：]|[\\n\\r]|$)','i');
  const m=texto.match(re);return m?m[1].trim().replace(/[;,\\s]+$/,''):'';
 }
 function preencherPeloTextoColado(){
  const texto=String(campoColado.value||'').trim();if(!texto)return;
  const protocolo=(texto.match(/\bprotocolo(?:\s+m[eé]todo)?\s*[-:#]?\s*(\d{4,})/i)||texto.match(/\b(\d{7,})\b/))?.[1]||'';
  const sdm=extrairCampoColado(texto,['SDM']);
  const circuito=extrairCampoColado(texto,['CIRCUITO']);
  const site=extrairCampoColado(texto,['SITE\\s*\\/\\s*CLIENTE','CLIENTE','SITE']);
  const cidade=extrairCampoColado(texto,['CIDADE','MUNICIPIO','MUNICÍPIO']);
  const skillTexto=extrairCampoColado(texto,['SKILL(?:\\s*NECESSARIA)?','HABILIDADE']);
  const servico=extrairCampoColado(texto,['SERVICO\\s*REALIZADO','ATIVIDADE','SERVICO']);
  const descricao=extrairCampoColado(texto,['DESCRI(?:C|Ç)(?:AO|ÃO)(?:\\s*\\/\\s*OBSERVA(?:C|Ç)(?:AO|ÃO))?','OBSERVA(?:C|Ç)(?:AO|ÃO)']);
  const data=texto.match(/(?:DATA(?:\s+PARA\s+CONTABILIZACAO)?|ENCERRADO(?:\s+EM)?)\s*[:：-]?\s*(\d{2})[\/.-](\d{2})[\/.-](\d{4})/i);
  const valor=texto.match(/(?:VALOR(?:\s+A\s+PAGAR)?|PAGAMENTO)\s*[:：-]?\s*(?:R\$\s*)?([\d.]+,\d{2}|\d+(?:\.\d{1,2})?)/i);
  const set=(nome,v)=>{if(v)form.elements[nome].value=v;};
  if(protocolo)form.elements.protocolo.value=protocolo;
  preencherChamadoPeloProtocolo();
  set('sdm',sdm);set('circuito',circuito);set('site',site);set('cidade',cidade);
  if(skillTexto){
   const t=skillTexto.toLowerCase();
   const skillValor=t.includes('vistoria')&&t.includes('wifi')?'vistoria_wifi':t.includes('vistoria')&&t.includes('voz')?'vistoria_voz':t.includes('dados')&&t.includes('vistoria')?'dados_vistoria':t.includes('vistoria')?'vistoria':t.includes('wifi')?'wifi':t.includes('infra')?'infra':t.includes('voz')?'voz':'dados';
   if(!Array.from(form.elements.skill.options).some(o=>o.value===skillValor)){const o=document.createElement('option');o.value=skillValor;o.textContent=nomeSkill(skillValor);form.elements.skill.append(o);}
   form.elements.skill.value=skillValor;
  }
  if(servico)set('servico',servico);
  else if(skillTexto&&!form.elements.servico.value){const nome=skillTexto.toLowerCase().includes('wifi')?'WiFi':skillTexto.toLowerCase().includes('dados')?'Dados':skillTexto.toLowerCase().includes('vistoria')?'Vistoria':'Voz';form.elements.servico.value='Incidente de '+nome+(cidade&&/recife|olinda|jaboatao|jaboatão/i.test(cidade)?' capital':'');}
  set('descricao',descricao||texto);
  if(data)form.elements.data.value=data[3]+'-'+data[2]+'-'+data[1];
  if(valor){const num=valor[1].includes(',')?valor[1].replace(/\./g,'').replace(',','.'):valor[1];form.elements.valor.value=Number(num)||'';}
  statusAuto.textContent='Informações identificadas do texto colado. Confira os campos e preencha o valor se ele não veio no texto.';
 }
 campoColado.addEventListener('input',preencherPeloTextoColado);
 const skill=Array.isArray(tecnico.sk)?tecnico.sk[0]:'';if(['voz','dados','wifi','infra','vistoria','vistoria_wifi','vistoria_voz','dados_vistoria'].includes(skill)){if(!Array.from(form.elements.skill.options).some(o=>o.value===skill)){const option=document.createElement('option');option.value=skill;option.textContent=nomeSkill(skill);form.elements.skill.append(option);}form.elements.skill.value=skill;}
 area.querySelector('[data-abrir-lancamento]').addEventListener('click',()=>{form.hidden=!form.hidden;});
 area.querySelector('[data-cancelar-lancamento]').addEventListener('click',()=>{form.reset();form.hidden=true;form.elements.data.value=dataInicio;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!adminAutorizado()||S?.t!=='adm'||SB_PROFILE?.tipo!=='admin'){nfToast('Somente o Administrador Geral autorizado pode registrar lançamentos manuais.','erro');return;}
  const v=Object.fromEntries(new FormData(form).entries()),valor=Number(v.valor);
  if(!Number.isFinite(valor)||valor<=0){nfToast('Informe um valor maior que zero.','erro');return;}
  const button=form.querySelector('[data-salvar-lancamento]');button.disabled=true;button.textContent='Salvando...';
  try{
   const {data,error}=await SB.rpc('registrar_lancamento_manual_pagamento',{p_tecnico_id:tecnico._id,p_protocolo:String(v.protocolo||'').trim(),p_sdm:String(v.sdm||'').trim(),p_circuito:String(v.circuito||'').trim(),p_site:String(v.site||'').trim(),p_cidade:String(v.cidade||'').trim(),p_skill:String(v.skill||'dados'),p_servico:String(v.servico||'').trim(),p_descricao:String(v.descricao||'').trim(),p_valor:valor,p_data:String(v.data||'')});
   if(error)throw error;if(!data)throw new Error('O servidor não confirmou o lançamento.');
   await sbLoadAll();rRl(RL_DT1_ATUAL,RL_DT2_ATUAL,false,false);sbSetConnectionBadge('Lançamento manual confirmado no Supabase',true);
   nfToast('Chamado e valor lançados para '+tecnico.n+'.','sucesso');dialog.close();rlAbrirChamadosProximoPeriodo(usuario);
  }catch(error){sbShowError('Não foi possível registrar o lançamento manual',error);}
  finally{if(form.isConnected){button.disabled=false;button.textContent='Salvar lançamento';}}
 });
};
})();