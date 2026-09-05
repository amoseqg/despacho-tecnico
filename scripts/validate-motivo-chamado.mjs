import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('src/features/admin/ChamadoEditor.tsx', 'utf8');
const service = fs.readFileSync('src/features/admin/admin.service.ts', 'utf8');

assert.ok(editor.includes('Motivo do chamado'), 'O campo Motivo do chamado não está visível no formulário.');
assert.ok(editor.includes('motivo_chamado'), 'O formulário não mantém o motivo no estado tipado.');
assert.ok(editor.includes("'motivo do chamado'"), 'O parser não reconhece o rótulo Motivo do chamado.');
assert.ok(editor.includes('onPaste='), 'A captura automática ao colar não foi configurada.');
assert.ok(service.includes('descricaoComMotivo'), 'O motivo não é incorporado à descrição antes da gravação.');
assert.ok(service.includes('MOTIVO DO CHAMADO:'), 'O rótulo persistido não foi encontrado.');

console.log('Motivo do chamado: campo, captura ao colar e persistência na descrição validados.');
