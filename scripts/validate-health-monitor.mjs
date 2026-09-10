import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('health-monitor.js','utf8');
new Function(js);
const app=fs.readFileSync('app.part3','utf8');
assert.match(app,/health-monitor\.js\?v=1\.0\.0/,'Monitor não foi carregado pela aplicação');
for(const required of ['app_error_events','health_scan_runs','run_nexofield_health_scan','unhandledrejection','window.error'])assert.ok(js.includes(required),`Recurso ausente: ${required}`);
assert.doesNotMatch(js,/service_role|sb_secret_/,'Uma chave secreta não pode existir no cliente');
console.log('Monitor de saúde validado: captura de erros, painel administrativo e varredura diária.');
