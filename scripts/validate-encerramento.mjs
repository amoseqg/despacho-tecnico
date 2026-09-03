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
