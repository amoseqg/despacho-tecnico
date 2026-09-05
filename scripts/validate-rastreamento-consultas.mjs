import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('app.part1','utf8');
const app=fs.readFileSync('app.part3','utf8');
const tracking=fs.readFileSync('tracking.js','utf8');
const vistorias=fs.readFileSync('vistorias.js','utf8');
const sql=fs.readFileSync('database/rastreamento-tecnico.sql','utf8');

assert.match(html,/data-tab="ft"/);
assert.match(html,/id="busca-fotos-admin"/);
assert.match(html,/id="busca-arquivados-admin"/);
assert.match(html,/id="btn-exportar-arquivados"/);
assert.match(app,/function renderFotosAdmin/);
assert.match(tracking,/navigator\.geolocation\.watchPosition/);
assert.match(tracking,/status:'andamento'/);
assert.match(tracking,/rastreamento_tecnico/);
assert.doesNotMatch(tracking,/Ao aceitar, o NexoField solicitará/);
assert.match(vistorias,/A lista está oculta/);
assert.match(vistorias,/Os relatórios estão ocultos/);
assert.match(vistorias,/function exportarChamadosArquivados/);
assert.match(sql,/enable row level security/);
assert.match(sql,/tecnico_id = \(select auth\.uid\(\)\)/);
assert.doesNotMatch(sql,/or tecnico_id = \(select auth\.uid\(\)\)/);
console.log('Rastreamento, fotos, buscas ocultas e exportação validados.');
