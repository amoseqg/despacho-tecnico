import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('app.part3','utf8');const ctx={S:{n:'Técnico teste'}};
for(const name of ['mascaraEncerramento','corrigirIdentificadoresEncerramento']){
 const fn=src.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))?.[0];assert.ok(fn);vm.runInNewContext(fn,ctx);
}
const c={pr:'3666009',sdm:'SDM-9988',si:'Site',en:'Endereço'};
const novo=ctx.mascaraEncerramento(c);assert.match(novo,/NUMERO SDM : SDM-9988\nNUMERO MÉTODO: 3666009\n/);
const antigo='NUMERO SDM : 3666009\nNUMERO MÉTODO: \nCLIENTE: Site\nSOLUÇÃO TECNICA: Troca e validação\nMATERIAL: 1 aparelho';
const corrigido=ctx.corrigirIdentificadoresEncerramento(antigo,c);
assert.equal(corrigido,'NUMERO SDM : SDM-9988\nNUMERO MÉTODO: 3666009\nCLIENTE: Site\nSOLUÇÃO TECNICA: Troca e validação\nMATERIAL: 1 aparelho');
assert.equal(ctx.corrigirIdentificadoresEncerramento(corrigido,c),corrigido);
const manual=antigo.replace('SDM : 3666009','SDM : OUTRO-123');assert.match(ctx.corrigirIdentificadoresEncerramento(manual,c),/SDM : OUTRO-123/);
const vazio=ctx.corrigirIdentificadoresEncerramento(antigo,{...c,sdm:''});assert.match(vazio,/SDM : \nNUMERO MÉTODO: 3666009\nCLIENTE/);
const crlf=ctx.corrigirIdentificadoresEncerramento(antigo.replaceAll('\n','\r\n'),c);assert.ok(crlf.includes('CLIENTE: Site\r\nSOLUÇÃO'));
assert.ok(src.includes('corrigirIdentificadoresEncerramento(anterior.relatorio || mascaraEncerramento(c),c)'));
console.log('PASS: Método e SDM distintos; máscara antiga corrigida; SDM manual, relato e quebras preservados; correção idempotente.');
const inputs={};
for(const id of ['ex-causa','ex-solucao','ex-validacao','ex-senha','ex-relatorio'])inputs[id]={value:'',setCustomValidity(v){this.error=v},reportValidity(){},focus(){}};
inputs['ex-causa'].options=['','Infracliente','Elétrica cliente','Elétrica concessionária','Mau uso','Vistoria'].map(value=>({value}));
ctx.el=id=>inputs[id];
for(const name of ['camposObrigatoriosEncerramento','trechoCampoEncerramento','preencherCamposEncerramento','sincronizarCamposEncerramento','validarCamposEncerramento'])vm.runInNewContext(src.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0],ctx);
inputs['ex-relatorio'].value=novo;
assert.equal(ctx.validarCamposEncerramento(),false);
const valores=['Infracliente','Troca do cabo\nTeste realizado','Operador confirmou','1234'];
const ids=['ex-causa','ex-solucao','ex-validacao','ex-senha'];
ids.forEach((id,i)=>inputs[id].value=valores[i]);
for(const id of ids){const anterior=inputs[id].value;inputs[id].value='  ';assert.equal(ctx.validarCamposEncerramento(),false);inputs[id].value=anterior;}
assert.equal(ctx.validarCamposEncerramento(),true);
assert.match(inputs['ex-relatorio'].value,/SOLUÇÃO TECNICA: Troca do cabo\nTeste realizado\nDATA ENCERRAMENTO:/);
ctx.preencherCamposEncerramento();ids.forEach((id,i)=>assert.equal(inputs[id].value,valores[i]));
inputs['ex-causa'].value='Outra';assert.equal(ctx.validarCamposEncerramento(),false);
inputs['ex-causa'].value='Vistoria';assert.equal(ctx.validarCamposEncerramento(),true);
inputs['ex-relatorio'].value=novo;ctx.preencherCamposEncerramento();assert.equal(inputs['ex-senha'].value,'');assert.equal(ctx.validarCamposEncerramento(),false);
assert.ok(src.indexOf('if(!validarCamposEncerramento())return;')<src.indexOf("c.st = 'concluida'; c.cc"));
console.log('PASS: campos vazios e causa inválida bloqueados; relatório multilinha e reabertura preservados; novo chamado limpa campos.');
