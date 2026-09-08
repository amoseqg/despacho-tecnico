import assert from 'node:assert/strict';
import fs from 'node:fs';

const partes = ['app.part1', 'app.part2', 'app.part3'];
const buffers = partes.map((arquivo, indice) => {
  const bytes = fs.readFileSync(arquivo);
  return indice < partes.length - 1 && bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
});
const html = Buffer.concat(buffers).toString('utf8');
const modulos = ['vistorias.js', 'tracking.js', 'release-info.js', 'appearance.js', 'admin-alerts.js'];

assert.doesNotMatch(html, /^(?:Warning: truncated output|Total output lines:|<{7}|={7}|>{7})/m,
  'O aplicativo contém truncamento ou conflito de mesclagem.');

for (const arquivo of modulos) {
  assert.ok(fs.existsSync(arquivo), `Módulo referenciado ausente: ${arquivo}`);
  const codigo = fs.readFileSync(arquivo, 'utf8');
  assert.doesNotThrow(() => new Function(codigo), `Erro de sintaxe em ${arquivo}`);
  assert.match(html, new RegExp(`<script[^>]+src=["']/?${arquivo.replace('.', '\\.')}(?:\\?[^"']*)?["']`),
    `O módulo ${arquivo} não está carregado pelo aplicativo.`);
}

const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(resultado => resultado[1]));
for (const arquivo of modulos) {
  const codigo = fs.readFileSync(arquivo, 'utf8');
  for (const resultado of codigo.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)) ids.add(resultado[1]);
}
for (const arquivo of modulos) {
  const codigo = fs.readFileSync(arquivo, 'utf8');
  const referencias = [
    ...codigo.matchAll(/\bel\(["']([^"']+)["']\)/g),
    ...codigo.matchAll(/\bgetElementById\(["']([^"']+)["']\)/g)
  ].map(resultado => resultado[1]);
  for (const id of referencias) assert.ok(ids.has(id), `${arquivo} usa o elemento inexistente #${id}`);
}

const dependenciasGlobais = {
  'vistorias.js': ['D', 'SB', 'SB_PROFILE', 'S', 'el', 'esc', 'nt', 'sbExigirSessaoAdmin', 'sbNameById', 'sbRenderizarTelas', 'sbShowError', 'sbUUID'],
  'tracking.js': ['D', 'SB', 'SB_PROFILE', 'S', 'esc', 'lsSet', 'rAt', 'rTat', 'rTdb', 'rTdp', 'sbShowError'],
  'admin-alerts.js': ['D', 'S', 'SB_PROFILE', 'LIMITE_PRAZO_MS', 'historicoAnteriorCircuito', 'materialInterior', 'logMeta', 'logStatus', 'nt']
};
const declarada = nome => new RegExp(`(?:function\\s+${nome}\\s*\\(|(?:const|let|var)\\s+${nome}\\b)`).test(html);
for (const [arquivo, nomes] of Object.entries(dependenciasGlobais)) {
  for (const nome of nomes) assert.ok(declarada(nome), `${arquivo} depende da variável ou função global ausente: ${nome}`);
}

const manipuladores = [...html.matchAll(/\bon(?:click|change|input|submit)=["'][^"']*?\b([A-Za-z_$][\w$]*)\s*\(/g)]
  .map(resultado => resultado[1])
  .filter(nome => !['alert', 'confirm'].includes(nome));
for (const nome of new Set(manipuladores)) {
  assert.ok(declarada(nome), `Manipulador HTML chama função ausente: ${nome}`);
}

console.log(`Integridade validada: ${partes.length} partes, ${modulos.length} módulos, ${ids.size} IDs e ${new Set(manipuladores).size} manipuladores HTML.`);
