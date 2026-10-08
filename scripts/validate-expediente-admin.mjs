import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const rows={pendencias_expediente_admin:[{id:'p1',chamado_id:'c1',status:'pausado',prazo_restante_segundos:7200,motivo:'Fora de expediente',administrador_nome:'Admin',retorno_em:'2026-10-09T11:00:00Z',vencimento_reprogramado:'2026-10-09T13:00:00Z',inicio_expediente:'08:00',fim_expediente:'18:00'}],solicitacoes_pendencia:[{id:'s1',chamado_id:'c1',status:'solicitada',motivo:'local_fechado'}],nao_pendenciamentos_chamados:[{id:'n1',chamado_id:'c1',motivo:'Cliente no local'}]};
const boxes=new Map(['nf-lista-expediente','lista-pendencias-admin'].map(id=>[id,{innerHTML:''}]));
let arquivado=false;
const ctx={SB_PROFILE:{id:'admin',tipo:'admin'},D:{ch:[{id:'c1',pr:'123',si:'Cliente',st:'andamento'}]},chamadoVisivel:()=>!arquivado,rCh(){},rAt(){},rTat(){},setTimeout(){},setInterval(){},console,
document:{getElementById:id=>boxes.get(id),addEventListener(){}},
SB:{from:t=>{const result=()=>Promise.resolve({data:rows[t]||[]});const chain={select:()=>chain,order:()=>chain,range:result,limit:result};return chain;},channel:()=>{const c={on:()=>c,subscribe(){}};return c;}}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('expediente-admin.js','utf8'),ctx);vm.runInContext(fs.readFileSync('pendencias.js','utf8'),ctx);
await ctx.NexoFieldExpediente.carregar();await ctx.NexoFieldPendencias.carregar();
assert.match(boxes.get('nf-lista-expediente').innerHTML,/Liberar chamado/);assert.match(boxes.get('nf-lista-expediente').innerHTML,/Excluir chamado da lista/);
assert.equal((boxes.get('lista-pendencias-admin').innerHTML.match(/nf-pendencia-excluir/g)||[]).length,2);
assert.match(ctx.NexoFieldExpediente.botao(ctx.D.ch[0]),/Liberar chamado/);ctx.SB_PROFILE.tipo='tecnico';assert.equal(ctx.NexoFieldExpediente.botao(ctx.D.ch[0]),'');assert.match(ctx.NexoFieldExpediente.resumo('c1'),/Prazo pausado/);
ctx.SB_PROFILE.tipo='admin';arquivado=true;ctx.NexoFieldExpediente.renderizar();ctx.NexoFieldPendencias.renderAdmin();
assert.ok(!boxes.get('nf-lista-expediente').innerHTML.includes('data-id="c1"'));assert.ok(!boxes.get('lista-pendencias-admin').innerHTML.includes('data-id="c1"'));assert.equal(ctx.D.ch.length,1);
const alerts={};vm.runInNewContext(fs.readFileSync('admin-alerts.js','utf8'),alerts);const now=Date.parse('2026-10-08T19:00:00Z'),helpers={limit:5*3600000,previous:()=>null,interior:()=>false};
assert.equal(alerts.NFAdminAlertsCore.build({ch:[{st:'andamento',pendenciaAtiva:true,am:'2026-10-07T00:00:00Z'}]},now,helpers).calls.length,0);
assert.equal(alerts.NFAdminAlertsCore.build({ch:[{st:'andamento',am:'2026-10-08T13:00:00Z',prazoPausadoSegundos:7200}]},now,helpers).calls[0].remaining,3600000);
console.log('PASS: ações administrativas, resumo técnico, exclusão de ambas as listas com histórico preservado e alertas descontando a pausa.');
