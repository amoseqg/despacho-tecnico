(function(){
 'use strict';

 function materiais(){
  return typeof D!=='undefined'&&Array.isArray(D.mat)?D.mat:[];
 }

 function exportarEstoqueLogistico(){
  if(typeof S==='undefined'||!['adm','log'].includes(S?.t)){
   alert('Acesse como administrador ou logística para exportar o estoque.');return;
  }
  const lista=materiais().slice().sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  if(!lista.length){alert('Não existem materiais cadastrados no estoque.');return;}
  const rows=lista.map(m=>({
   'Material':m.nome||'',
   'Unidade':m.unidade||'',
   'Quantidade em estoque':Number(m.estoque||0),
   'Situação':Number(m.estoque||0)>0?'Disponível':'Sem estoque'
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:58},{wch:12},{wch:22},{wch:18}];
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:3}})};
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Estoque Logístico');
  const data=new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
  XLSX.writeFile(wb,'Estoque_Logistico_'+data+'.xlsx');
 }

 function configurarEstoque(listaId){
  const lista=document.getElementById(listaId);
  if(!lista||lista.dataset.estoqueOculto==='1')return;
  lista.dataset.estoqueOculto='1';
  lista.classList.add('hidden');
  lista.setAttribute('aria-hidden','true');
  const observer=new MutationObserver(()=>{if(lista.innerHTML)lista.innerHTML='';});
  observer.observe(lista,{childList:true,subtree:true});
  lista.innerHTML='';
  const card=lista.closest('.card');
  const titulo=card?.querySelector('h3');
  if(!card||!titulo)return;
  const topo=document.createElement('div');
  topo.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px';
  titulo.style.marginBottom='0';
  titulo.parentNode.insertBefore(topo,titulo);
  topo.appendChild(titulo);
  const botao=document.createElement('button');
  botao.type='button';botao.className='btn btn-p';botao.textContent='📊 Exportar estoque em Excel';
  botao.addEventListener('click',exportarEstoqueLogistico);topo.appendChild(botao);
  const aviso=document.createElement('div');
  aviso.className='info';aviso.textContent='A relação de materiais fica oculta. Digite o nome ou modelo no campo Material para pesquisar.';
  lista.parentNode.insertBefore(aviso,lista);
 }

 function iniciar(){configurarEstoque('ml-estoque-lista');configurarEstoque('lg-estoque-lista');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
 window.exportarEstoqueLogistico=exportarEstoqueLogistico;
})();
