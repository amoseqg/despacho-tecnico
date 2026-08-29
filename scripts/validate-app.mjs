import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nomes = ['app.part1', 'app.part2', 'app.part3'];
const partes = nomes.map((nome, indice) => {
  const bytes = fs.readFileSync(nome);
  return indice < nomes.length - 1 && bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
});
const html = Buffer.concat(partes).toString('utf8');

assert.match(html, /^<!doctype html>/i, 'O HTML recomposto não começa com DOCTYPE.');
assert.match(html, /<\/html>\s*$/i, 'O HTML recomposto não termina corretamente.');

const idsObrigatorios = [
  'card-adm', 'btn-add-ch', 'c-descricao-colada', 'c-pr', 'c-sdm',
  'c-ci', 'c-si', 'c-en', 'c-opcoes', 'ex-fotos', 'ex-fotos-preview'
];
for (const id of idsObrigatorios) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Elemento obrigatório ausente: ${id}`);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]).filter(id => !id.includes('${'));
const duplicados = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
assert.deepEqual(duplicados, [], `IDs duplicados: ${duplicados.join(', ')}`);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1])
  .filter(Boolean);
for (const [indice, codigo] of scripts.entries()) {
  try { new Function(codigo); }
  catch (erro) { throw new Error(`JavaScript inválido no bloco ${indice + 1}: ${erro.message}`); }
}

const parte3 = fs.readFileSync('app.part3', 'utf8');
const extrator = parte3.match(/function extrairCampoDaDescricao\(texto,tipo\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(extrator, 'Função de extração de protocolo não encontrada.');
const contexto = {};
vm.runInNewContext(extrator, contexto);
const casos = [
  ['Protocolo: 123456\nSDM: 9988', 'protocolo', '123456'],
  ['PROTOCOLO DO CHAMADO Nº PE-2026/778', 'protocolo', 'PE-2026/778'],
  ['Ticket = INC-88442', 'protocolo', 'INC-88442'],
  ['Nº SDM: 0012399', 'sdm', '0012399']
];
for (const [texto, tipo, esperado] of casos) {
  assert.equal(contexto.extrairCampoDaDescricao(texto, tipo), esperado, `Falha ao extrair ${tipo} de: ${texto}`);
}

console.log(`Validação concluída: ${ids.length} elementos, ${scripts.length} blocos JavaScript e ${casos.length} formatos de protocolo/SDM.`);
