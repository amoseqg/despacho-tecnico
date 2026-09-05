import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('app.part1','utf8');
const codigo=fs.readFileSync('app.part3','utf8');
assert.doesNotMatch(html,/id="c-motivo"/,'O campo Motivo do chamado ainda aparece no formulário.');
assert.doesNotMatch(codigo,/Motivo do chamado:<\/b>/,'O motivo ainda aparece nos cartões.');
assert.doesNotMatch(codigo,/motivo_chamado:c\.motivo/,'O motivo ainda é gravado por novos chamados.');
console.log('Campo e exibições de Motivo do chamado removidos.');
