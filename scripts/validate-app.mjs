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

const consultasEscola = [
  ['26184710|ESCOLA ESTADUAL INDIGENA VO SALU', '26184710', 'ESCOLA ESTADUAL INDIGENA VO SALU'],
  ['26184710 | ESCOLA ESTADUAL INDÍGENA VO SALU | GRE 13', '26184710', 'ESCOLA ESTADUAL INDÍGENA VO SALU'],
  ['ESCOLA ESTADUAL INDIGENA VO SALU', '', 'ESCOLA ESTADUAL INDIGENA VO SALU']
];
for(const [entrada,codigoEsperado,nomeEsperado] of consultasEscola){
  const codigo=(entrada.match(/(?:^|\D)(\d{8})(?:\D|$)/)||[])[1]||'';
  const nome=entrada.replace(/^\d{8}\s*[|;:\-–—]?\s*/,'').replace(/\s*\|\s*GRE\s*\d+.*$/i,'').trim();
  assert.equal(codigo,codigoEsperado,`Falha ao identificar INEP em: ${entrada}`);
  assert.equal(nome,nomeEsperado,`Falha ao limpar o nome da escola em: ${entrada}`);
}

console.log(`Validação concluída: ${ids.length} elementos, ${scripts.length} blocos JavaScript, ${casos.length} formatos de protocolo/SDM e ${consultasEscola.length} formatos de escola.`);

assert.ok(html.includes('NexoField'), 'A identidade NexoField deve estar no código-fonte');
assert.ok(!html.includes('Despacho Técnico'), 'A marca antiga não pode permanecer no código-fonte');

// Executa funções reais da aplicação com respostas controladas do servidor.
function funcao(nome){
  const inicio=parte3.search(new RegExp(`(?:async )?function ${nome}\\(`));
  assert.ok(inicio>=0,`Função ausente: ${nome}`);
  const resto=parte3.slice(inicio), proxima=resto.slice(1).search(/\n(?:async )?function |\nlet |\nconst |\ndocument\./);
  return proxima<0?resto:resto.slice(0,proxima+1);
}
const ctx={D:{mr:[],ch:[]},SB_PROFILE:{id:'operador'},S:{t:'log'},el:()=>({disabled:false}),
  alert:()=>{},confirm:()=>true,lsSet:()=>{},rLog:()=>{},sbRecarregarDados:async()=>{},sbShowError:()=>{},
  LOG_TAG:'[[LOGISTICA]]'};
vm.createContext(ctx);
for(const nome of ['logMeta','logObsBase','logObs','materialEntregueArquivado','limparMateriaisEntregues','materiaisLiberadosTecnicos','sbNum','normalizarCircuito','numeroCircuito','dataChamadoMs','chaveCircuitoReincidencia','historicoAnteriorCircuito','sbPersistirAprovacoes']) vm.runInContext(funcao(nome),ctx);
vm.runInContext('let limpezaEntreguesEmCurso=false; const JANELA_REINCIDENCIA_MS=30*24*60*60*1000;',ctx);
for(const [entrada,esperado] of [[12.5,12.5],['12.5',12.5],['12,5',12.5],['R$ 1.234,56',1234.56],['R$ 1.234',1234],['',0],[null,0],['inválido',0]]) assert.equal(ctx.sbNum(entrada),esperado);
const entregue={id:'1',status:'entregue',obs:'Observação\n[[LOGISTICA]]{"rastreamento":"BR123"}'};
const pendente={id:'2',status:'separado',obs:'[[LOGISTICA]]{"etapa":"aguardando_aceite"}'};
ctx.D.mr=[entregue,pendente];let escritas=0;
ctx.SB={from:()=>({update:campos=>{
  escritas++;let id,status;
  const q={eq:(k,v)=>{if(k==='id')id=v;if(k==='status')status=v;return q},or:()=>q,select:()=>q,single:async()=>{assert.equal(status,'entregue');return {data:{id,observacao:campos.observacao}}}};return q;
}})};
await ctx.limparMateriaisEntregues();
assert.equal(escritas,1);assert.equal(ctx.D.mr.length,2);
assert.equal(ctx.materialEntregueArquivado(entregue),true);
assert.equal(ctx.logMeta(entregue).rastreamento,'BR123');
assert.equal(ctx.logObsBase(entregue),'Observação');
assert.equal(ctx.materiaisLiberadosTecnicos().length,2,'Exportação deve preservar os arquivados');
assert.equal(ctx.materialEntregueArquivado(pendente),false);
await ctx.limparMateriaisEntregues();assert.equal(escritas,1,'Limpar novamente não regrava');
const falha={id:'3',status:'entregue',obs:''};ctx.D.mr=[falha];
ctx.SB={from:()=>({update:()=>{const q={eq:()=>q,or:()=>q,select:()=>q,single:async()=>({error:new Error('offline')})};return q}})};
await ctx.limparMateriaisEntregues();assert.equal(ctx.materialEntregueArquivado(falha),false,'Falha não pode ocultar o registro');
ctx.S={t:'tec'};await ctx.limparMateriaisEntregues();assert.equal(ctx.materialEntregueArquivado(falha),false);
const atual={id:'novo',ci:'12345',cr:'2026-09-01T12:00:00Z'};
ctx.D.ch=[{id:'antigo',ci:'12345',st:'concluida',cc:'2026-08-31T12:00:00Z',te:'outro'}];
assert.equal(ctx.historicoAnteriorCircuito(atual).chamado.id,'antigo');
ctx.D.ch[0].cc='2026-08-02T12:00:00Z';assert.equal(ctx.historicoAnteriorCircuito(atual),null,'Exatos 30 dias não são reincidência');
ctx.D.ch[0].cc='2026-08-31T12:00:00Z';ctx.D.ch[0].ci='99999';assert.equal(ctx.historicoAnteriorCircuito(atual),null);
ctx.SB_PROFILE={id:'admin',tipo:'admin'};ctx.sbExigirSessaoAdmin=async()=>ctx.SB_PROFILE;ctx.sbUUID=()=>true;ctx.sbSetConnectionBadge=()=>{};
ctx.SB={from:()=>({upsert:()=>({select:async()=>({data:[]})})})};
await assert.rejects(()=>ctx.sbPersistirAprovacoes([{id:'1'}],'aprovado',''),'Aprovação não confirmada deve falhar');
ctx.SB={from:()=>({upsert:()=>({select:async()=>({data:[{chamado_id:'1',status:'aprovado'}]})})})};
assert.ok(await ctx.sbPersistirAprovacoes([{id:'1'}],'aprovado',''));
assert.match(html,/<details id="lg-tramite">\s*<summary/);
assert.ok(!html.includes('btn-toggle-tramite'),'O clique pertence ao título');
console.log('Regressões concluídas: limpeza persistida, falha de gravação, preservação do histórico, permissão, decimais, reincidência e confirmação de aprovação.');
