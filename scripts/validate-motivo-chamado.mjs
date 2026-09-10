import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('src/features/admin/ChamadoEditor.tsx', 'utf8');
const service = fs.readFileSync('src/features/admin/admin.service.ts', 'utf8');

assert.ok(!editor.includes('Motivo do chamado'), 'O campo Motivo do chamado ainda está visível no formulário.');
assert.ok(!editor.includes('motivo_chamado'), 'O formulário ainda mantém o motivo no estado.');
assert.ok(!editor.includes("'motivo do chamado'"), 'O parser ainda captura o motivo.');
assert.ok(editor.includes('onPaste='), 'A captura automática ao colar não foi configurada.');
assert.ok(!service.includes('motivo_chamado:'), 'O motivo ainda é enviado para novos chamados.');
assert.ok(!service.includes('descricaoComMotivo'), 'O motivo ainda está sendo incorporado à descrição.');

console.log('Campo Motivo do chamado removido do formulário e da persistência.');
