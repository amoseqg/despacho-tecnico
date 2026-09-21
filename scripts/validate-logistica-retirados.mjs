import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('app.part1a','utf8');
const js=fs.readFileSync('app.part3','utf8');
const sql=fs.readFileSync('database/materiais-retirados-auditoria.sql','utf8');

assert.ok(html.includes('id="lg-retirados"'));
assert.ok(html.includes('id="btn-lg-retirada"'));
assert.ok(html.includes('id="lg-auditoria-lista"'));
assert.ok(html.includes('id="lg-cadastro-material"'));
assert.ok(html.includes('id="lg-mat-nome"'));
assert.ok(html.includes('id="btn-lg-add-material"'));
assert.ok(!html.includes('id="lg-mat-cadastro-lista"'), 'A relação completa de materiais deve continuar oculta da Área Logística.');
assert.match(js,/function addMaterialLogistica\(\)[\s\S]*?\['adm','log'\]\.includes\(S\?\.t\)/);
assert.match(js,/const temLogistica=p\.tipo==='admin'\|\|p\.tipo==='logistica'/);
assert.ok(js.includes("SB.rpc('registrar_retirada_planta'"));
assert.ok(js.includes("SB.rpc('recuperar_material_estoque'"));
assert.ok(js.includes("SB.rpc('ajustar_estoque_logistico'"));
assert.match(sql,/enable row level security/i);
assert.match(sql,/recuperado_por uuid references public\.perfis/);
console.log('Logística: acesso, cadastro recolhível, retirada, recuperação, auditoria e listagem oculta validados.');
