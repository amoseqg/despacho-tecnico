import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8');
const fn=src.match(/async function cfEx\(\) \{[^]*?\n\}/)[0];
for(const waiting of [false,true]){
 const c={id:'test',te:'tec',st:'andamento',ex:{fotos:['foto-antiga'],...(waiting?{enviadoValidacaoEm:'2026-10-01'}:{})}};
 const calls=[];const inputs=new Map();const el=id=>{if(!inputs.has(id))inputs.set(id,{value:'',dataset:{},textContent:'Enviar',disabled:false});return inputs.get(id)};
 const ctx={D:{ch:[c]},EID:'test',el,validarCamposEncerramento:()=>true,finalizarMascaraEncerramento(){},sbEnviarFotos:async()=>['foto-nova'],sbPersistirFinalizacao:async c=>{assert.equal(c.st,'concluida');calls.push('persistido')},limparRascunhoExecucao:async()=>{},lsSet(){},clsEx(){},rTat(){},rTco(){},rTdb(){},pararRastreamentoTecnico(){},nfToast(){},sbShowError(){assert.fail('Falha inesperada')},ag:()=>'',Date};
 vm.runInNewContext(fn,ctx);await ctx.cfEx();assert.deepEqual(calls,['persistido']);assert.deepEqual(Array.from(c.ex.fotos),['foto-antiga','foto-nova']);
}
assert.doesNotMatch(fn,/sbEnviarParaValidacaoOperador|Aguarde o operador/);
console.log('PASS: envio novo e anteriormente aguardando operador vão direto para conclusão administrativa; fotos preservadas.');
