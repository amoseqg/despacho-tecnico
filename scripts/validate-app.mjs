import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nomes = ['app.part1a', 'app.part1b', 'app.part2', 'app.part3'];
const partes = nomes.map((nome, indice) => {
  const bytes = fs.readFileSync(nome);
  return indice < nomes.length - 1 && bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
});
const html = Buffer.concat(partes).toString('utf8');

assert.match(html, /^<!doctype html>/i, 'O HTML recomposto não começa com DOCTYPE.');
assert.match(html, /<\/html>\s*$/i, 'O HTML recomposto não termina corretamente.');
assert.doesNotMatch(html, /Warning: truncated output|Total output lines:/, 'Os arquivos contêm marcadores de conteúdo truncado.');

const idsObrigatorios = [
  'card-adm', 'btn-add-ch', 'c-descricao-colada', 'c-pr', 'c-sdm',
  'c-ci', 'c-si', 'c-en', 'c-opcoes', 'ex-fotos', 'ex-fotos-preview',
  'btn-criar-os-servico', 'os-servico-atividade', 'os-servico-site',
  'os-servico-cidade', 'os-servico-regiao', 'os-servico-skill', 'os-servico-tecnico',
  'os-servico-circuito', 'os-servico-circuito-opcoes', 'os-servico-circuito-status',
  'os-servico-descricao-colada', 'os-servico-descricao-status',
  'os-tipo-escolha', 'btn-escolher-os-servico', 'btn-escolher-os-manutencao',
  'form-os-servico', 'form-os-manutencao', 'at-filtro-protocolo', 'pl-filtro-protocolo'
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
const parte1a = fs.readFileSync('app.part1a', 'utf8');
const seletorChamado = parte3.match(/function atualizarTecnicosChamado\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(seletorChamado,'Seletor de técnicos de chamados não encontrado.');
const campoTecnico={value:'',innerHTML:''};
const contextoTecnicos={
 D:{tc:[{u:'andre',n:'André Pereira Barbosa',r:'capital',sk:['voz','infra'],ar:['norte','leste']}]},
 el:id=>id==='c-tecnico'?campoTecnico:{value:id==='c-sk'?'dados':id==='c-re'?'capital':id==='c-area'?'leste':''},
 nomesTecnicosPlanilha:()=>['ANDRÉ','FERNANDO'],
 tecnicoIndicado:(t,indicados)=>indicados.some(i=>String(t.n).toLowerCase().includes(String(i).toLowerCase())),
 tecnicoCompativel:(t,c)=>t.r===c.re&&(!c.skill||t.sk.includes(c.skill))&&(!c.area||t.ar.includes(c.area)),
 areasTec:t=>t.ar,skillsTec:t=>t.sk,nomeArea:x=>x,nomeSkill:x=>x,esc:x=>String(x)
};
vm.runInNewContext(`${seletorChamado}\natualizarTecnicosChamado()`,contextoTecnicos);
assert.match(campoTecnico.innerHTML,/André Pereira Barbosa/,'Técnico indicado permanece visível sem a skill cadastrada.');
assert.match(campoTecnico.innerHTML,/FERNANDO — indicado na planilha, sem cadastro ativo/,'Indicado sem perfil ativo deve aparecer como pendente de cadastro.');
assert.match(seletorChamado,/D\.tc\.slice\(\)\.sort/,'Todos os técnicos ativos devem aparecer, com os compatíveis primeiro.');
const redirecionar=parte3.match(/function opRedirecionar\(id\) \{[\s\S]*?\n\}/)?.[0]||'';
assert.ok(redirecionar,'A opção de redirecionamento deve existir.');
assert.match(redirecionar,/D\.tc\.filter\(t => t\.u !== c\.te\)/,'O redirecionamento deve listar todos os técnicos ativos, exceto o técnico atual.');
assert.doesNotMatch(redirecionar,/tecnicoCompativel/,'A lista de redirecionamento não pode ocultar técnicos por skill ou região.');
assert.match(parte3,/function slaRegiao\(v,skill=''\) \{ return skill==='vistoria'\?'24h'/,'A skill Vistoria deve receber SLA de 24 horas.');
assert.match(parte1a,/value=\"Mudança de endereço\|200\.00\"/,'Mudança de endereço deve custar R$ 200,00.');
assert.match(parte1a,/id=\"ex-material-nome\"[\s\S]*?id=\"ex-material-unidade\"[\s\S]*?id=\"ex-material-qtd\"[\s\S]*?id=\"ex-material-valor-unit\"[\s\S]*?id=\"ex-material-total\"/,'O formulário deve coletar material, unidade, quantidade, valor unitário e total.');
assert.match(parte3,/setInterval\(\(\)=>\{if\(SB_PROFILE\)void nfChatAtualizarBadge\(\);\},15000\)/,'O contador de mensagens novas deve atualizar periodicamente.');
const filtroAtendimento = parte3.match(/function rAt\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(filtroAtendimento, 'A lista de Atendimento deve existir.');
assert.match(parte1a, /id="at-filtro-protocolo"[^>]*oninput="rAt\(\)"/, 'A busca de protocolo deve atualizar a lista ao digitar.');
assert.match(filtroAtendimento, /el\('at-filtro-protocolo'\)[\s\S]*?identificacaoOs\(c\)[\s\S]*?c\.sdm[\s\S]*?includes\(normalizarProtocolo\(filtroProtocolo\)\)/, 'Atendimento deve filtrar por protocolo, SDM e identificadores de OS.');
assert.match(parte1a, /id="pl-filtro-protocolo"[^>]*oninput="filtrarProtocoloPlanilha\(\)"/, 'A planilha de aprovação deve permitir filtrar por protocolo.');
const filtroAprovacao = parte3.match(/function filtrarProtocoloPlanilha\(\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.match(filtroAprovacao, /dataset\.protocolo[\s\S]*?includes\(termo\)/, 'A busca da aprovação deve filtrar as linhas pelo protocolo.');
const removerDuplicados = parte3.match(/function removerBlocosDuplicados\(texto\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(removerDuplicados, 'A limpeza de blocos repetidos do relatório deve existir.');
const ctxDuplicados = {}; vm.runInNewContext(removerDuplicados, ctxDuplicados);
assert.equal(ctxDuplicados.removerBlocosDuplicados('PROTOCOLO: 123\nRELATÓRIO: ok\nPROTOCOLO: 123\nRELATÓRIO: ok'), 'PROTOCOLO: 123\nRELATÓRIO: ok', 'Relatório duplicado deve aparecer somente uma vez.');
const funcaoRmat = parte3.match(/function rTmat\(\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(funcaoRmat, 'A lista de materiais do técnico deve existir.');
const camposRmat = Object.fromEntries(['tm-protocolo','tm-material','tm-lista'].map(id=>[id,{value:'',innerHTML:''}]));
const ctxRmat = {el:id=>camposRmat[id],S:{u:'tecnico-a'},D:{ch:[{id:'aberto',te:'tecnico-a',st:'andamento',pr:'PROTO-ATIVO',si:'Atendimento atual'},{id:'fechado',te:'tecnico-a',st:'concluida',pr:'PROTO-FECHADO',si:'Chamado encerrado'},{id:'outro',te:'tecnico-b',st:'andamento',pr:'PROTO-OUTRO',si:'Outro técnico'}],mat:[],mr:[]},escM:v=>String(v||''),materialById:()=>null};
vm.runInNewContext(`${funcaoRmat}\nrTmat()`,ctxRmat);
assert.match(camposRmat['tm-protocolo'].innerHTML,/PROTO-ATIVO/,'A solicitação deve listar chamado ativo do técnico.');
assert.doesNotMatch(camposRmat['tm-protocolo'].innerHTML,/PROTO-FECHADO|PROTO-OUTRO/,'A solicitação deve ocultar chamados encerrados e de outros técnicos.');
assert.match(parte3,/const protocolosExibidos=new Set\(\)[\s\S]*?protocolosExibidos\.has\(protocolo\)/,'A aprovação deve remover protocolos duplicados da planilha.');
assert.match(parte3,/x\.te===S\.u&&x\.st==='andamento'/,'A gravação da solicitação de material deve validar que o chamado continua em atendimento.');
const validacaoExcecao=parte3.match(/const tecnicoSelecionado = D\.tc\.find[\s\S]*?const dtexec = el\('c-dtexec'\)\.value;/)?.[0]||'';
assert.match(validacaoExcecao,/!tecnicoCompativelComChamado && !liberarArea/,'Técnicos fora da skill/cobertura exigem liberação excepcional.');
const seletorTecnicosServico = parte3.match(/function atualizarTecnicosOsServico\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(seletorTecnicosServico, 'Atualizador de técnicos da OS de Serviços não encontrado.');
assert.match(seletorTecnicosServico, /const lista=D\.tc\.slice\(\)/, 'A OS de Serviços deve listar todos os técnicos ativos.');
assert.doesNotMatch(seletorTecnicosServico, /D\.tc\.filter|skillsTec\(t\)\.includes|areasTec\(t\)\.includes/, 'A lista da OS de Serviços não deve filtrar técnicos por skill ou área.');
const extratorRotulado = parte3.match(/function normalizarRotuloDescricao\(v\)\{[\s\S]*?\n\}/)?.[0];
const leitorRotulos = parte3.match(/function extrairTextoRotulado\(texto,rotulos\)\{[\s\S]*?\n\}/)?.[0];
const preenchimentoServico = parte3.match(/function preencherDadosOsServicoDaDescricao\(texto\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(extratorRotulado && leitorRotulos && preenchimentoServico, 'Parser da descrição colada da OS de Serviços não encontrado.');
const camposServico = Object.fromEntries(['os-servico-circuito','os-servico-site','os-servico-cidade','os-servico-endereco','os-servico-contato','os-servico-horario','os-servico-descricao','os-servico-descricao-status'].map(id=>[id,{value:'',dataset:{},style:{}}]));
const contextoServico = {el:id=>camposServico[id],normalizarCircuito:v=>String(v||'').toUpperCase(),setTimeout:()=>{},buscarCircuitoOsServico:()=>{}};
const textoServico = 'Circuito: NOVO-123\nSite / Cliente: Unidade Teste\nCidade: Recife\nEndereço: Rua A, 10\nContato: Maria 81999990000\nHorário de Expediente: 08:00 às 17:00';
vm.runInNewContext([extratorRotulado,leitorRotulos,preenchimentoServico,'preencherDadosOsServicoDaDescricao('+JSON.stringify(textoServico)+')'].join('\n'),contextoServico);
assert.equal(camposServico['os-servico-circuito'].value,'NOVO-123','Circuito novo deve ser extraído da descrição mesmo sem cadastro.');
assert.equal(camposServico['os-servico-site'].value,'Unidade Teste','Site deve ser preenchido pela descrição colada.');
assert.equal(camposServico['os-servico-cidade'].value,'Recife','Cidade deve ser preenchida pela descrição colada.');
assert.equal(camposServico['os-servico-endereco'].value,'Rua A, 10','Endereço deve ser preenchido pela descrição colada.');
assert.equal(camposServico['os-servico-contato'].value,'Maria 81999990000','Contato deve ser preenchido pela descrição colada.');
assert.equal(camposServico['os-servico-horario'].value,'08:00 às 17:00','Horário deve ser preenchido pela descrição colada.');
const salvarSiteFn = parte3.match(/async function salvarCadastroSiteOsServico\(c\)\{[\s\S]*?\n\}/)?.[0];
const insertsSites=[];
let siteEncontradoNoBanco=null;
const consultaSites={select(){return this;},eq(){return this;},maybeSingle(){return Promise.resolve({data:siteEncontradoNoBanco,error:null});},insert(linha){insertsSites.push(linha);this.linha=linha;return this;},single(){return Promise.resolve({data:{id:1,...this.linha},error:null});}};
const contextoCadastroSite={SB:{from:tabela=>{assert.equal(tabela,'sites');return consultaSites;}},registrarSiteOsServico:site=>site,siteOsServicoDoBanco:site=>site};
vm.runInNewContext(salvarSiteFn,contextoCadastroSite);
await contextoCadastroSite.salvarCadastroSiteOsServico({ci:camposServico['os-servico-circuito'].value,si:camposServico['os-servico-site'].value,cid:camposServico['os-servico-cidade'].value,en:camposServico['os-servico-endereco'].value,contato:camposServico['os-servico-contato'].value,horario:camposServico['os-servico-horario'].value,re:'capital',area:'oeste'});
assert.equal(insertsSites.length,1,'Circuito ausente no banco deve ser incluído depois da OS.');
assert.equal(insertsSites[0].circuito,'NOVO-123','Cadastro novo deve salvar o circuito colado.');
assert.equal(insertsSites[0].site,'Unidade Teste','Cadastro novo deve salvar o site colado.');
assert.equal(insertsSites[0].endereco,'Rua A, 10','Campos extraídos da descrição devem ser preservados no cadastro.');
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

assert.ok(html.includes('MÉTODO Telecom'), 'A marca MÉTODO Telecom deve estar no código-fonte');
assert.ok(!html.includes('Despacho Técnico'), 'A marca antiga não pode permanecer no código-fonte');
const carregador=fs.readFileSync('index.html','utf8');
const historicoVersoes=fs.readFileSync('release-info.js','utf8');
const versaoAtual=historicoVersoes.match(/version:'([^']+)'/)?.[1];
assert.ok(versaoAtual,'O histórico deve informar a versão atual.');
assert.ok(carregador.includes(`const versao='${versaoAtual}'`),'O carregador deve invalidar o cache com a versão atual.');
assert.match(carregador,/html\.includes\('Warning: truncated output'\)/,'O carregador deve rejeitar arquivos incompletos.');
for(const parte of ['app.part1a','app.part1b','app.part2','app.part3'])assert.match(carregador,new RegExp(`/${parte}\\?v=`),`Cache busting ausente para ${parte}.`);
const salvarEstoque=parte3.match(/async function salvarQuantidadeEstoqueConfirmada\([\s\S]*?\n\}/)?.[0]||'';
assert.ok(salvarEstoque.indexOf('q=Number(qCampo?.value)')<salvarEstoque.indexOf('m=resolverMaterialEstoque(selectId,buscaId)'),'A quantidade deve ser capturada antes de resolver novamente o material.');
assert.match(salvarEstoque,/\['adm','log'\]\.includes\(S\?\.t\)/,'Somente Administrador e Logística podem ajustar o estoque.');
assert.match(salvarEstoque,/String\(data\?\.id\)!==String\(m\.id\)/,'O material retornado pelo servidor deve ser conferido.');
assert.match(salvarEstoque,/confirmado!==q/,'O retorno do servidor deve ser comparado com a quantidade solicitada.');
assert.match(parte3,/function ajusteEstoque\(\)\{return salvarQuantidadeEstoqueConfirmada/,'O Administrador deve usar a gravação confirmada.');

const modalLogistica=parte3.match(/function abrirGestaoSolicitacaoMaterial\(id\)\{[\s\S]*?\n\}/)?.[0]||'';
const salvarTramite=parte3.match(/async function salvarGestaoSolicitacaoMaterial\(dialog,id\)\{[\s\S]*?\n\}/)?.[0]||'';
assert.ok(modalLogistica,'A janela de gestão logística deve existir.');
for(const campo of ['ml-gestao-estoque','ml-gestao-separada','ml-gestao-transito-qtd','ml-gestao-entregue','ml-gestao-prazo','ml-gestao-codigo'])assert.ok(modalLogistica.includes(campo),`Campo de trâmite ausente: ${campo}`);
assert.match(parte3,/function podeOperarLogistica\(\)\{[^\n]*\['admin','logistica'\]/,'A gestão deve permitir perfis de Administrador e Logística.');
assert.match(parte3,/if\(!event\.target\.closest\('button,a,input,select,textarea'\)\)abrirGestaoSolicitacaoMaterial/,'Clicar no cartão deve abrir a gestão sem interceptar botões internos.');
assert.match(parte3,/async function atualizarEstoqueMaterial\([\s\S]*?SB\.rpc\('ajustar_estoque_logistico'/,'A conferência física do estoque deve ser registrada pelo RPC auditado.');
assert.match(salvarTramite,/\.eq\('estoque',estoqueAntesDaSeparacao\)/,'A separação deve proteger o estoque contra atualizações concorrentes.');
assert.match(salvarTramite,/etapa==='em_transito'&&\(!prazo\|\|!codigo\)/,'A etapa de transporte exige previsão e rastreio.');
assert.match(salvarTramite,/const meta=\{\.\.\.logMeta\(r\),etapa,quantidadeEmTransito:etapa==='em_transito'\?separada:0/,'A quantidade em transporte deve refletir a separação.');
assert.match(salvarTramite,/if\(estoqueDescontado&&estoqueAntesDaSeparacao!==null\)/,'Falhas ao registrar a separação devem tentar reverter o desconto de estoque.');
assert.match(parte3,/function rastreioTramite\(r\)\{[\s\S]*?meta\.etapa==='em_transito'\|\|!!meta\.transitoEm/,'A timeline deve mostrar o transporte mesmo sem rastreio preenchido.');
assert.match(funcaoRmat,/aceitar=r\.status==='separado'&&\['aguardando_aceite','em_transito'\]\.includes\(meta\.etapa\)/,'O técnico só pode aceitar material separado e encaminhado.');
const aceitarMaterialFn=parte3.match(/async function aceitarMaterial\(id\)\{[\s\S]*?\n\}/)?.[0]||'';
assert.match(aceitarMaterialFn,/quantidadeEntregueTecnico:q/,'O aceite técnico deve registrar a quantidade recebida.');
console.log('Trâmite logístico: janela, estoque, transporte, rastreio e aceite do técnico validados.');
assert.match(parte3,/async function ajusteEstoqueLogistica\(\)\{\s*return salvarQuantidadeEstoqueConfirmada/,'A Logística deve usar a gravação confirmada.');
const estoque=fs.readFileSync('stock-export.js','utf8');
assert.match(estoque,/function exportarEstoqueLogistico\(\)/,'A exportação do estoque em Excel deve existir.');
assert.match(estoque,/configurarEstoque\('ml-estoque-lista'\)/,'O estoque do administrador deve ser ocultado.');
assert.match(estoque,/configurarEstoque\('lg-estoque-lista'\)/,'O estoque da logística deve ser ocultado.');
assert.match(carregador,/fetch\('\/stock-export\.js\?v='\+versao/,'O módulo do estoque deve ser carregado sem cache antigo.');
assert.match(carregador,/replace\('<\/body>','<script>'\+stock/,'O módulo do estoque deve ser incorporado ao aplicativo antes da abertura.');
assert.match(html,/Criar OS de Serviços/,'A área administrativa deve oferecer o cadastro de OS de Serviços em Chamados.');
assert.match(html,/id="form-os-servico" class="card hidden"/,'O formulário de serviços deve iniciar oculto até a escolha do administrador.');
assert.match(html,/id="form-os-manutencao" class="card hidden"/,'O formulário de manutenção deve iniciar oculto até a escolha do administrador.');
assert.match(html,/id="os-servico-circuito"[\s\S]*?id="os-servico-circuito-opcoes"[\s\S]*?id="os-servico-circuito-status"/,'A OS de Serviços deve permitir procurar e selecionar circuitos cadastrados.');
assert.match(html,/id="os-servico-descricao-colada"/,'OS de Serviços deve permitir colar a descrição do chamado.');
assert.match(html,/id="btn-escolher-os-servico"[\s\S]*?Criar OS de Serviços[\s\S]*?id="btn-escolher-os-manutencao"[\s\S]*?Nova OS de Manutenção/,'A tela de Chamados deve mostrar as duas opções antes dos formulários.');
assert.match(parte3,/btn-escolher-os-servico[\s\S]*?abrirFormularioOs\('servico'\)/,'A opção de serviço deve abrir o formulário correspondente.');
assert.match(parte3,/btn-escolher-os-manutencao[\s\S]*?abrirFormularioOs\('manutencao'\)/,'A opção de manutenção deve abrir o formulário correspondente.');
assert.match(parte3,/btn-voltar-os-escolha[\s\S]*?escolhaOs\?\.classList\.remove\('hidden'\)/,'Os formulários devem permitir voltar à escolha do tipo.');
assert.match(html,/Protocolo e SDM são dispensados/,'A OS de Serviços não deve exigir protocolo ou SDM.');
assert.match(html,/sem circuito, preencha os dados manualmente/i,'A OS de Serviços deve permitir cadastro manual sem circuito.');
assert.match(parte3,/async function addOsServico\(\)/,'O cadastro de OS de Serviços deve ter um fluxo próprio.');
assert.match(parte3,/async function buscarCircuitoOsServico\(\)[\s\S]*?SITE_INDEX\.get\(chave\)[\s\S]*?SITE_NUMBER_INDEX\.get\(somenteNumero\)/,'O formulário de Serviços deve localizar circuitos pelo mesmo catálogo da Manutenção.');
assert.match(parte3,/function preencherSiteOsServico\(site\)[\s\S]*?os-servico-site[\s\S]*?os-servico-cidade[\s\S]*?os-servico-endereco/,'Encontrar o circuito deve carregar os dados existentes do site.');
assert.match(parte3,/SB\.from\('sites'\)\.select\(colunas\)[\s\S]*?ilike\('circuito'/,'A busca também deve consultar circuitos incluídos diretamente no banco.');
assert.match(parte3,/async function salvarCadastroSiteOsServico\(c\)[\s\S]*?SB\.from\('sites'\)\.select\(colunas\)\.eq\('circuito',circuito\)[\s\S]*?SB\.from\('sites'\)\.insert\(linha\)/,'Circuito ausente no banco deve ser cadastrado em sites.');
assert.doesNotMatch(parte3.match(/async function salvarCadastroSiteOsServico\(c\)\{[\s\S]*?\n\}/)?.[0]||'',/existenteLocal|!c\.en\|\|!c\.contato\|\|!c\.horario/,'Dados opcionais do site não devem impedir o cadastro.');
const fluxoOsServico=parte3.match(/async function addOsServico\(\)[\s\S]*?\n\}/)?.[0]||'';
assert.ok(fluxoOsServico.indexOf("SB.from('chamados').insert(linha)")<fluxoOsServico.indexOf('salvarCadastroSiteOsServico(novoChamado)'),'O cadastro de circuito/site deve acontecer depois que a OS for confirmada.');
assert.match(parte3,/ci:circuito/,'O circuito informado deve ser salvo junto da OS de Serviços.');
assert.match(parte3,/circuito:c\.ci\|\|''/,'O circuito deve ser persistido no campo circuito do banco de chamados.');
assert.match(parte3,/tipoOs:'servico',osPeConectado:[\s\S]*?atividadeServico:atividade/,'A OS deve preservar sua classificação e a OS PE Conectado opcional.');
assert.match(parte3,/tipo_os:c\.tipoOs==='servico'\?'servico':'manutencao'/,'A classificação da OS deve ser gravada no Supabase.');
assert.match(parte3,/tipoOs:c\.tipo_os\|\|'manutencao'/,'A classificação deve ser carregada do Supabase para a área do técnico.');
assert.match(parte3,/btn-ac[\s\S]*?btn-rc/,'OS de Serviços devem usar o mesmo fluxo de aceite e recusa dos chamados.');

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
vm.runInContext(funcao('salvarQuantidadeEstoqueConfirmada'),ctx);
const campoQtd={value:'40'},botaoEstoque={disabled:false,innerHTML:'Salvar',textContent:'Salvar'},materialEstoque={id:'mat-1',estoque:0};
ctx.el=id=>id==='qtd'?campoQtd:id==='btn'?botaoEstoque:null;
ctx.resolverMaterialEstoque=()=>{campoQtd.value='0';return materialEstoque;};
ctx.SB={rpc:(nome,params)=>{
 assert.equal(nome,'ajustar_estoque_logistico');
 assert.equal(params.p_material_id,'mat-1');assert.equal(params.p_nova_quantidade,40);
 return {single:async()=>({data:{id:'mat-1',estoque:40}})};
}};
let renderizacoesEstoque=0;
for(const perfil of ['adm','log']){
 ctx.S={t:perfil};campoQtd.value='40';materialEstoque.estoque=0;
 await ctx.salvarQuantidadeEstoqueConfirmada({selectId:'sel',buscaId:'busca',qtdId:'qtd',botaoId:'btn',renderizar:()=>renderizacoesEstoque++});
 assert.equal(materialEstoque.estoque,40,`${perfil} deve aplicar somente o valor confirmado pelo servidor`);
}
const chamadasPermitidas=renderizacoesEstoque;
for(const perfil of ['tec','ope']){ctx.S={t:perfil};campoQtd.value='40';await ctx.salvarQuantidadeEstoqueConfirmada({selectId:'sel',buscaId:'busca',qtdId:'qtd',botaoId:'btn',renderizar:()=>renderizacoesEstoque++});}
assert.equal(renderizacoesEstoque,chamadasPermitidas,'Técnico e operador não podem atualizar o estoque.');
ctx.S={t:'log'};
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
ctx.SB={from:()=>({upsert:()=>({select:async()=>({data:[{chamado_id:'1',status:'aprovado',atualizado_em:'2026-10-08T18:00:00Z'}]})})})};
assert.ok(await ctx.sbPersistirAprovacoes([{id:'1'}],'aprovado',''));
assert.match(html,/<details id="lg-tramite">\s*<summary/);
assert.ok(!html.includes('btn-toggle-tramite'),'O clique pertence ao título');
console.log('Regressões concluídas: limpeza persistida, falha de gravação, preservação do histórico, permissão, decimais, reincidência e confirmação de aprovação.');

// Exclusão visual individual: persistência, concorrência, restauração e exportação.
for(const nome of ['materialOcultoDaLista','materialVisivelNaLista','arquivarMaterialIndividual'])vm.runInContext(funcao(nome),ctx);
vm.runInContext('let mostrarHistoricoMateriais=false; const arquivosMateriaisEmCurso=new Set();',ctx);
ctx.rMl=()=>{};ctx.S={t:'adm'};
const registro={id:'demanda',status:'separado',qtdSeparada:2,obs:'Observação preservada\n[[LOGISTICA]]{"etapa":"aguardando_aceite","rastreamento":"BR456"}'};
ctx.D.mr=[registro];let gravacoes=0,erroGravacao=false;
ctx.SB={from:tabela=>{assert.equal(tabela,'solicitacoes_material');return {update:campos=>{
 gravacoes++;assert.deepEqual(Object.keys(campos),['observacao']);const filtros={};
 const q={eq:(k,v)=>{filtros[k]=v;return q},or:()=>q,select:()=>q,single:async()=>{
  assert.equal(filtros.id,registro.id);assert.equal(filtros.status,registro.status);assert.equal(filtros.observacao,registro.obs);
  return erroGravacao?{data:null,error:new Error('conflito de atualização')}:{data:{id:registro.id,observacao:campos.observacao}};
 }};return q;
}}}};
await ctx.arquivarMaterialIndividual(registro.id);
assert.equal(ctx.materialVisivelNaLista(registro),false);
assert.equal(ctx.D.mr.length,1);assert.equal(registro.status,'separado');assert.equal(registro.qtdSeparada,2);
assert.equal(ctx.logMeta(registro).rastreamento,'BR456');assert.equal(ctx.logObsBase(registro),'Observação preservada');
assert.equal(ctx.materiaisLiberadosTecnicos().length,1);
const recarregado=JSON.parse(JSON.stringify(registro));assert.equal(ctx.materialOcultoDaLista(recarregado),true);
vm.runInContext('mostrarHistoricoMateriais=true',ctx);assert.equal(ctx.materialVisivelNaLista(recarregado),true);
await ctx.arquivarMaterialIndividual(registro.id);assert.equal(ctx.materialOcultoDaLista(registro),false);
erroGravacao=true;await ctx.arquivarMaterialIndividual(registro.id);assert.equal(ctx.materialOcultoDaLista(registro),false);
ctx.S={t:'tec'};const antes=gravacoes;await ctx.arquivarMaterialIndividual(registro.id);assert.equal(gravacoes,antes);
ctx.S={t:'log'};erroGravacao=false;await ctx.arquivarMaterialIndividual(registro.id);assert.equal(ctx.materialOcultoDaLista(registro),true);
console.log('Exclusão individual: administrador/logística, histórico após recarga, restauração, exportação, conflito e restrição de técnico validados.');
