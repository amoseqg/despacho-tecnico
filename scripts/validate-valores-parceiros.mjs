import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8');
function fn(name){const a=src.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(a>=0);const tail=src.slice(a);const b=tail.slice(1).search(/\n(?:async )?function |\nlet |\nconst |\ndocument\./);return b<0?tail:tail.slice(0,b+1);}
const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{},classList:{toggle(){},add(){}}});return nodes.get(id);};
const owner='391d92ed-3a0d-42f7-9e5f-e3f5172b3e1b';
const ctx={S:{t:'adm'},SB_PROFILE:{id:owner,tipo:'admin',ativo:true},D:{tc:[{u:'tec',n:'Parceiro',r:'capital'}],ch:[{id:'ativo',te:'tec',st:'concluida',ex:{total:'R$ 1.234,56',valorCorrigido:1234.56},ap:{status:'aprovado'}},{id:'excluido',te:'tec',st:'concluida',ex:{total:'R$ 100,00',pagamentoExcluido:true},ap:{status:'aprovado'}}]},el,nt:()=> 'Parceiro',esc:s=>String(s),valorInfo:()=>'',adminGeral:()=>true};
vm.createContext(ctx);vm.runInContext("let PLU=null;let RL_DT1_ATUAL='';let RL_DT2_ATUAL='';",ctx);
for(const name of ['podeGerirValoresParceiros','validarValorParceiro','numeroExcel','dataEncerramentoChamado','dataBrasilISO','formatarDataBrasil','datasPagamentoHtml','opPl','chamadosPagamentoPeriodo','atividadesDoTecnicoAtual'])vm.runInContext(fn(name),ctx);
assert.equal(ctx.podeGerirValoresParceiros(),true);
for(const id of ['outro-admin','tecnico']){ctx.SB_PROFILE.id=id;assert.equal(ctx.podeGerirValoresParceiros(),false);ctx.opPl('tec');assert.ok(!el('pl-tb-body').innerHTML.includes('btn-valor-parceiro'));}
ctx.SB_PROFILE.id=owner;ctx.opPl('tec');assert.ok(el('pl-tb-body').innerHTML.includes('Corrigir valor'));assert.ok(el('pl-tb-body').innerHTML.includes('Restaurar valor'));assert.equal(el('pl-tot').textContent,'R$ 1234,56');
assert.equal(ctx.chamadosPagamentoPeriodo().length,1);ctx.S.u='tec';assert.equal(ctx.atividadesDoTecnicoAtual().length,1);
for(const [input,expected] of [['130,00',130],['1.234,56',1234.56],['0',0],['',null],['-10',null],['10,999',null],['abc',null]])assert.equal(ctx.validarValorParceiro(input),expected);
ctx.SB_PROFILE.ativo=false;assert.equal(ctx.podeGerirValoresParceiros(),false);
console.log('PASS: perfil exclusivo, ações em aprovados, total corrigido, exclusão nos pagamentos, histórico/restauração e valores inválidos.');
