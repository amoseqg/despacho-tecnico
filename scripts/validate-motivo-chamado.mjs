import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('app.part1', 'utf8');
const codigo = fs.readFileSync('app.part3', 'utf8');

assert.match(html, /id="c-motivo"/, 'Campo Motivo do chamado ausente na área administrativa.');
assert.match(codigo, /motivo:extrairTextoRotulado/, 'Captura automática do motivo ausente.');
assert.match(codigo, /el\('c-motivo'\)\.value=dados\.motivo/, 'Motivo extraído não é exibido no campo.');
assert.match(codigo, /descricaoComMotivo\(el\('c-de'\)\.value,el\('c-motivo'\)\.value\)/, 'Motivo não é incorporado à descrição salva.');

const funcao = codigo.match(/function descricaoComMotivo\(descricao,motivo\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(funcao, 'Função de persistência do motivo não encontrada.');
const contexto = {};
vm.runInNewContext(funcao, contexto);
assert.equal(contexto.descricaoComMotivo('Sem acesso ao serviço', 'Ramal mudo'), 'Sem acesso ao serviço\nMOTIVO DO CHAMADO: Ramal mudo');
assert.equal(contexto.descricaoComMotivo('MOTIVO DO CHAMADO: Antigo', 'Novo'), 'MOTIVO DO CHAMADO: Novo');

console.log('Motivo do chamado: exibição, captura e gravação dentro da descrição validadas.');
