import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('app.part1', 'utf8');
const codigo = fs.readFileSync('app.part3', 'utf8');

assert.match(html, /id="c-motivo"/, 'Campo Motivo do chamado ausente na área administrativa.');
assert.match(codigo, /motivo:extrairTextoRotulado/, 'Captura automática do motivo ausente.');
assert.match(codigo, /el\('c-motivo'\)\.value=dados\.motivo/, 'Motivo extraído não é exibido no campo.');
assert.match(codigo, /if\(!this\.value\.trim\(\)\)[\s\S]*el\('c-motivo'\)\.value=''/, 'O motivo não é limpo quando a descrição é apagada.');
assert.match(codigo, /motivo_chamado:c\.motivo\|\|null/, 'Motivo não é salvo na coluna própria do chamado.');
assert.doesNotMatch(codigo, /descricaoComMotivo/, 'O motivo ainda está sendo incorporado à descrição.');
assert.match(codigo, /c\.motivo_chamado\|\|''/, 'O motivo separado não é recuperado do banco.');
assert.match(codigo, /Motivo do chamado:<\/b>/, 'O motivo separado não aparece nos cartões.');

console.log('Motivo do chamado: exibição, captura e gravação em campo separado validadas.');
