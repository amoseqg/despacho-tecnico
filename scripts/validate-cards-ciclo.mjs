import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8'),elements=new Map();
function node(id){if(!elements.has(id))elements.set(id,{id,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},append(){},insertBefore(){},setAttribute(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
const now=Date.now(),day=86400000,items=[
 {id:'closed',pr:'1001',st:'concluida',am:new Date(now-4*3600000).toISOString(),cc:new Date(now-2*3600000).toISOString()},
 {id:'late',pr:'1002',st:'concluida',am:new Date(now-10*3600000).toISOString(),cc:new Date(now-2*3600000).toISOString()},
 {id:'old',pr:'1003',st:'concluida',am:new Date(now-50*day).toISOString(),cc:new Date(now-49*day).toISOString()},
 {id:'active',pr:'1004',st:'andamento',am:new Date(now-2*3600000).toISOString()}
];
const ctx={D:{ch:items},NF_PAINEL_CONFIG:null,NF_CICLO_MS:30*day,Date,LIMITE_PRAZO_MS:5*3600000,el:node,chamadoVisivel:c=>c.id!=='late',inicioIndicadoresPainel:()=>now-30*day,dadosIndicadoresTecnicos:()=>({reincidencias:[]}),esc:v=>v,nt:()=>'',historicoTransferenciasHtml:()=>'',botaoArquivoChamado:()=>'',document:{createElement:()=>node('db-janela-chamados'),body:{append(){}}}};
for(const name of ['inicioCicloDashboard','avaliacaoPrazoDashboard','chamadosDoCardDashboard','abrirCardDashboard'])vm.runInNewContext(src.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0],ctx);
assert.equal(ctx.chamadosDoCardDashboard('dentro-prazo').length,1);
assert.equal(ctx.chamadosDoCardDashboard('perda-prazo').length,1);
ctx.abrirCardDashboard('perda-prazo');assert.equal(node('db-janela-chamados').open,true);assert.ok(node('db-lista-chamados').innerHTML.includes('1002'));
ctx.NF_PAINEL_CONFIG={zerar_30_dias:true,inicio_ciclo:new Date(now-61*day).toISOString()};
assert.ok(ctx.inicioCicloDashboard()>now-2*day);assert.equal(ctx.chamadosDoCardDashboard('concluida').length,1);
assert.equal(ctx.chamadosDoCardDashboard('historico').length,4);assert.equal(ctx.chamadosDoCardDashboard('andamento').length,1);
const rows=Array.from({length:1101},(_,id)=>({id}));ctx.SB={from(){return {select(){return this},order(){return this},async range(a,b){return {data:rows.slice(a,b+1),error:null}}}}};
vm.runInNewContext(src.match(/async function sbTabelaCompleta\([^]*?\n\}/)[0],ctx);
assert.equal((await ctx.sbTabelaCompleta('chamados','id')).data.length,1101);
console.log('PASS: janela imediata, chamados arquivados de qualidade, ciclo de 30 dias, ativos preservados, histórico e paginação acima de mil registros.');
