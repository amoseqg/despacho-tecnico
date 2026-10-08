import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8');
function fn(name){const a=src.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(a>=0);const tail=src.slice(a);const b=tail.slice(1).search(/\n(?:async )?function |\nlet |\nconst |\ndocument\./);return b<0?tail:tail.slice(0,b+1);}
const fields=new Map();const el=id=>{if(!fields.has(id))fields.set(id,{value:'',checked:false,textContent:''});return fields.get(id);};
const c={id:'caso',st:'concluida',dtexec:'2026-10-07',cc:'2026-10-08T16:01:38.863Z',ap:{status:'aprovado',data:'2026-10-08T17:48:20.598Z'}};
const ctx={el,agendarRascunhoExecucao(){},D:{ch:[c]},Intl,Date};vm.createContext(ctx);
for(const name of ['numeroExcel','dataEncerramentoChamado','dataBrasilISO','formatarDataBrasil','datasPagamentoHtml','chamadosPagamentoPeriodo','atualizarCobrancaKm','calcTotal'])vm.runInContext(fn(name),ctx);
assert.equal(ctx.formatarDataBrasil('2026-10-08'),'08/10/2026');
assert.equal(ctx.formatarDataBrasil('2026-10-08T02:59:59Z'),'07/10/2026');
assert.equal(ctx.formatarDataBrasil('2026-10-08T03:00:00Z'),'08/10/2026');
assert.ok(ctx.datasPagamentoHtml(c).includes('08/10/2026'));assert.ok(ctx.datasPagamentoHtml(c).includes('Aprovado: 08/10/2026'));
assert.equal(ctx.chamadosPagamentoPeriodo('2026-10-08','2026-10-08').length,1);assert.equal(ctx.chamadosPagamentoPeriodo('2026-10-07','2026-10-07').length,0);
el('ex-km').value='210';el('ex-vatv').value='150';el('ex-tmat').value='R$ 0,00';el('ex-vkm').value='R$ 170,00';
ctx.atualizarCobrancaKm();assert.equal(el('ex-vkm').value,'R$ 0,00');assert.equal(el('ex-total').textContent,'R$ 150,00');
el('ex-cobrar-km').checked=true;ctx.atualizarCobrancaKm();assert.equal(el('ex-vkm').value,'R$ 170,00');assert.equal(el('ex-total').textContent,'R$ 320,00');
el('ex-km').value='40';ctx.atualizarCobrancaKm();assert.equal(el('ex-vkm').value,'R$ 0,00');
el('ex-cobrar-km').checked=false;el('ex-vkm').value='R$ 170,00';ctx.calcTotal();assert.equal(el('ex-total').textContent,'R$ 150,00');
console.log('PASS: data civil, fuso Brasil, encerramento versus agendamento, aprovação, filtros e KM somente com confirmação.');
