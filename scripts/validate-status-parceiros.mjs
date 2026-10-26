import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext(src.match(/function servicosPagamentoUnicos\([^]*?\n\}/)[0],ctx);
const itens=[
 {id:'copia1',te:'helton',pr:'3678840'},
 {id:'original',te:'helton',pr:'3678840',ap:{status:'aprovado',data:'2026-10-26'}},
 {id:'copia2',te:'helton',pr:'3678840'},
 {id:'suporte',te:'outro',pr:'3678840'},
 {id:'novo',te:'helton',pr:'novo'},
 {id:'sem-protocolo',te:'helton'},
 {id:'sem-protocolo2',te:'helton'}
];
const unicos=ctx.servicosPagamentoUnicos(itens);
assert.equal(unicos.length,5);
assert.equal(unicos.find(c=>c.te==='helton'&&c.pr==='3678840').id,'original');
assert.equal(itens[0].ap,undefined,'Não aprova cópias automaticamente no banco.');
const rejeitado={id:'revisado',te:'helton',pr:'3678840',ap:{status:'rejeitado',data:'2026-10-27'}};
assert.equal(ctx.servicosPagamentoUnicos([...itens,rejeitado])[0].id,'revisado');
const excluido={id:'excluido',te:'helton',pr:'3678840',ex:{pagamentoExcluido:true}};
assert.equal(ctx.servicosPagamentoUnicos([...itens,excluido])[0].id,'excluido');
// Consulta com mais de mil decisões deve carregar também a última página.
const rows=Array.from({length:1203},(_,i)=>({chamado_id:String(i),status:'aprovado'}));
ctx.SB={from:()=>({select:()=>({order:()=>({range:async(a,b)=>({data:rows.slice(a,b+1),error:null})})})})};
vm.runInContext(src.match(/async function sbTabelaCompleta\([^]*?\n\}/)[0],ctx);
assert.equal((await ctx.sbTabelaCompleta('aprovacoes','chamado_id')).data.length,1203);
assert.match(src,/sbTabelaCompleta\('aprovacoes','chamado_id'\)/);
assert.doesNotMatch(src,/if\(c.ap\) apRows.push/,'Salvamento geral não regrava decisões antigas.');
console.log('PASS: duplicatas aprovadas, suporte separado, pendências reais, rejeição, exclusão e 1203 aprovações.');
