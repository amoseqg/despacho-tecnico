/* Histórico público de versões: atualizar antes de cada publicação. */
(function(root){
 'use strict';
 const releases=[{
  version:'1.2.0',date:'2026-09-05',title:'Motivo do chamado',
  changes:['Campo Motivo do chamado incluído na área administrativa.','O motivo é capturado automaticamente ao colar a descrição e fica registrado dentro do texto do chamado.']
 },{
  version:'1.1.5',date:'2026-09-04',title:'Vistoria na causa raiz',
  changes:['Opção Vistoria adicionada à lista obrigatória de causa raiz no encerramento do chamado.']
 },{
  version:'1.1.4',date:'2026-09-04',title:'Vistoria integrada à execução',
  changes:['Novo tipo de atividade Vistoria no valor de R$ 150,00.','Anexo do relatório de vistoria movido para a tela Executar Serviço, abaixo das fotos.','Campo de observação do relatório incluído e atalho antigo removido do cabeçalho técnico.']
 },{
  version:'1.1.3',date:'2026-09-04',title:'Pesquisa nas solicitações de material',
  changes:['Campo de pesquisa na área Material Logístico para localizar solicitações pelo nome do técnico ou protocolo.','Pesquisa disponível tanto na lista atual quanto no histórico de itens apagados.']
 },{
  version:'1.1.2',date:'2026-09-04',title:'Fotos e rascunho no Android',
  changes:['Rascunho do serviço restaurado automaticamente após recarga da página.','Ações separadas para tirar foto e anexar imagens da galeria.','Novas fotos são acumuladas sem remover as anteriores.']
 },{
  version:'1.1.1',date:'2026-09-03',title:'Correções restauradas e cache atualizado',
  changes:['Número Método e SDM mantidos nos campos corretos.','Campos obrigatórios e opções de causa raiz restaurados.','Arquivos versionados para impedir que o navegador reutilize uma edição antiga.']
 },{
  version:'1.1.0',date:'2026-09-03',title:'Campos obrigatórios no encerramento',
  changes:['Causa raiz com seleção entre Infracliente, Elétrica cliente, Elétrica concessionária e Mau uso.','Encerramento exige causa raiz, solução técnica, validação Vectra/Umtelecom e senha preenchidos.']
 },{
  version:'1.0.1',date:'2026-09-03',title:'Correção dos identificadores no encerramento',
  changes:[
   'Número Método preenchido com o protocolo do chamado; Número SDM utiliza seu próprio campo.',
   'Máscaras antigas corrigidas ao abrir para edição, preservando o relato e o SDM informado pelo técnico.'
  ]
 },{
  version:'1.0.0',date:'2026-09-03',title:'Primeira versão registrada',
  changes:[
   'Gestão de chamados, despacho e acompanhamento por administrador e técnico.',
   'Exclusão de chamados da lista com histórico preservado e restauração.',
   'Envio de relatórios de vistoria em PDF pelo técnico e download pelo administrador.',
   'Solicitação, separação, rastreamento e recebimento de materiais.',
   'Relatórios de atividades, análise de pagamentos e exportações.',
   'Indicadores de prazo e reincidência, alertas administrativos e escolha de aparência.',
   'Consulta da versão e do histórico de atualizações dentro do aplicativo.'
  ]
 }];
 root.NexoFieldRelease=Object.freeze({current:releases[0].version,releases:Object.freeze(releases.map(r=>Object.freeze({...r,changes:Object.freeze(r.changes)})))});
 if(typeof document==='undefined')return;
 function init(){
  if(document.getElementById('nf-release-dialog'))return;
  const css=document.createElement('style');css.textContent=`
   .nf-version-button{border:1px solid #9baab8!important;border-radius:8px;padding:6px 10px!important;background:#fff!important;color:#16324f!important;font:600 12px system-ui!important;cursor:pointer;white-space:nowrap}
   .nf-version-login{margin:14px auto 0;display:block}
   #nf-release-dialog{box-sizing:border-box;width:min(600px,calc(100% - 32px));max-height:85dvh;margin:auto;border:1px solid #cbd5e1;border-radius:16px;padding:24px;background:#fff;color:#243442;box-shadow:0 24px 70px #0004;overflow:auto;font:14px/1.55 system-ui}
   #nf-release-dialog::backdrop{background:#0b172ab3}
   #nf-release-dialog h2{font-size:22px;color:#16324f;margin:0 0 6px}
   #nf-release-dialog h3{font-size:16px;margin:18px 0 6px;color:#126a72}
   #nf-release-dialog p{margin:8px 0}#nf-release-dialog ul{padding-left:22px}#nf-release-dialog li{margin:7px 0}
   #nf-release-dialog .nf-release-close{display:block;margin:18px 0 0 auto;border:0;border-radius:8px;padding:9px 18px;background:#16324f;color:#fff;cursor:pointer}
  `;document.head.append(css);
  const dialog=document.createElement('dialog');dialog.id='nf-release-dialog';dialog.setAttribute('aria-labelledby','nf-release-title');
  const title=document.createElement('h2');title.id='nf-release-title';title.textContent='Sobre o NexoField';dialog.append(title);
  const lead=document.createElement('p');lead.textContent='Versão carregada neste aplicativo: '+releases[0].version;dialog.append(lead);
  const intro=document.createElement('p');intro.textContent='Este registro identifica a edição do aplicativo e as funcionalidades incluídas. Informe o número da versão ao solicitar suporte.';dialog.append(intro);
  for(const release of releases){
   const heading=document.createElement('h3');heading.textContent=`Versão ${release.version} • ${release.date.split('-').reverse().join('/')}`;dialog.append(heading);
   const subtitle=document.createElement('p');subtitle.textContent=release.title;dialog.append(subtitle);
   const list=document.createElement('ul');for(const text of release.changes){const item=document.createElement('li');item.textContent=text;list.append(item);}dialog.append(list);
  }
  const note=document.createElement('p');note.textContent='A numeração começa nesta edição. As funcionalidades anteriores foram reunidas no registro 1.0.0.';dialog.append(note);
  const close=document.createElement('button');close.type='button';close.className='nf-release-close';close.textContent='Fechar';close.addEventListener('click',()=>dialog.close());dialog.append(close);document.body.append(dialog);
  let opener=null;
  dialog.addEventListener('close',()=>opener?.focus());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});
  function button(parent,login=false){if(!parent)return;const b=document.createElement('button');b.type='button';b.className='nf-version-button'+(login?' nf-version-login':'');b.textContent='Sobre / Versão '+releases[0].version;b.addEventListener('click',()=>{opener=b;dialog.showModal();});parent.append(b);}
  document.querySelectorAll('.user-bar').forEach(bar=>button(bar));
  const loginBrand=document.querySelector('.nf-login-brand');button(loginBrand?.parentElement,true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
