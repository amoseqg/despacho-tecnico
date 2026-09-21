import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('app.part3','utf8');

assert.match(src,/if\(a==='lab'&&!adminGeral\(\)\)/,'A aba de diagnóstico deve ser protegida pelo Administrador Geral.');
assert.match(src,/persistSession:false/,'O diagnóstico deve usar uma sessão de autenticação isolada.');
assert.match(src,/signInWithPassword\(\{email:user,password:pass\}\)/,'O diagnóstico deve validar as credenciais no servidor.');
assert.match(src,/client\.from\('perfis'\)/,'O diagnóstico deve validar o perfil operacional.');
assert.match(src,/client\.from\('sites'\)/,'O diagnóstico deve consultar o circuito informado.');
assert.match(src,/password\.value=''/,'A senha deve ser apagada após a autenticação.');

const historyWrites=[...src.matchAll(/localStorage\.setItem\('nexofield_diagnostico_last_v1',JSON\.stringify\(([^;]+)\)\)/g)].map(match=>match[1]);
assert.ok(historyWrites.length>=2,'Resultados aprovados e falhos devem ser registrados no histórico.');
for(const value of historyWrites)assert.ok(!/pass(?:word)?\b/i.test(value),'A senha não pode fazer parte do histórico do diagnóstico.');

console.log('Diagnóstico genérico: acesso, perfil, circuito, isolamento e descarte de senha validados.');
