/* Relatórios em bucket privado. O RLS aplica as permissões no servidor. */
let NF_ARQUIVOS=new Map();
let NF_VISTORIAS=[];
let NF_ARQUIVANDO=new Set();
let NF_ENVIANDO_VISTORIA=false;
function chamadoVisivel(c){return !NF_ARQUIVOS.get(c.id)?.ativo;}
function botaoArquivoChamado(c){return SB_PROFILE?.tipo==='admin'?`<button type="button" class="btn btn-r btn-del-ch" data-id="${esc(c.id)}">Excluir da lista</button>`:'';}
async function carregarArquivosVistorias(){
 const perfil=SB_PROFILE?.id;if(!perfil)return;
 async function todas(tabela){const rows=[];for(let inicio=0;;inicio+=1000){const {data,error}=await SB.from(tabela).select('*').order(tabela==='chamados_arquivados'?'chamado_id':'id').range(inicio,inicio+999);if(error)throw error;rows.push(...data);if(data.length<1000)return rows;}}
 const [arquivos,relatorios]=await Promise.all([todas('chamados_arquivados'),todas('relatorios_vistoria')]);
 if(SB_PROFILE?.id!==perfil)return;
 NF_ARQUIVOS=new Map(arquivos.map(r=>[r.chamado_id,r]));NF_VISTORIAS=relatorios;
 renderArquivoChamados();renderVistorias();
}
async function alterarArquivoChamado(id,restaurar=false){
 if(NF_ARQUIVANDO.has(id))return;
 const c=D.ch.find(x=>x.id===id);if(!c)return;
 if(!confirm(restaurar?`Restaurar o chamado ${c.pr} na lista?`:`Excluir o chamado ${c.pr} da lista? O chamado e seu histórico continuarão salvos e poderão ser restaurados.`))return;
 NF_ARQUIVANDO.add(id);
 try{
  const perfil=await sbExigirSessaoAdmin();
  if(!sbUUID(id))throw new Error('Aguarde a sincronização do chamado antes de excluir da lista.');
  const {data,error}=await SB.from('chamados_arquivados').upsert({chamado_id:id,ativo:!restaurar,alterado_por:perfil.id,alterado_em:new Date().toISOString()},{onConflict:'chamado_id'}).select().single();
  if(error)throw error;
  NF_ARQUIVOS.set(id,data);sbRenderizarTelas();renderArquivoChamados();
 }catch(err){sbShowError('Não foi possível alterar o chamado',err);}
 finally{NF_ARQUIVANDO.delete(id);}
}
function renderArquivoChamados(){
 const box=el('lista-arquivados');if(!box||SB_PROFILE?.tipo!=='admin')return;
 const registros=D.ch.filter(c=>!chamadoVisivel(c));
 box.innerHTML=registros.map(c=>`<div class="os"><strong>${esc(c.pr)}</strong><div>${esc(c.si)}</div><div class="os-r">Status preservado: ${esc(c.st)} • Técnico: ${esc(nt(c.te)||'—')}</div><div class="os-r">Excluído da lista em: ${new Date(NF_ARQUIVOS.get(c.id).alterado_em).toLocaleString('pt-BR')}</div><button type="button" class="btn btn-p nf-restaurar-ch" data-id="${esc(c.id)}">Restaurar na lista</button></div>`).join('')||'<div class="empty">Nenhum chamado excluído da lista.</div>';
}
function renderVistorias(){
 const seletor=el('vistoria-chamado');
 if(seletor && SB_PROFILE?.tipo==='tecnico'){
  const atual=seletor.value;
  seletor.innerHTML='<option value="">Selecione o chamado...</option>'+D.ch.filter(c=>c.te===S?.u&&sbUUID(c.id)).map(c=>`<option value="${esc(c.id)}">${esc(c.pr)} — ${esc(c.si)}</option>`).join('');
  if([...seletor.options].some(o=>o.value===atual))seletor.value=atual;
 }
 for(const tipo of ['admin','tecnico']){
  const box=el('vistorias-'+tipo);if(!box)continue;
  if(SB_PROFILE?.tipo!==tipo){box.innerHTML='';continue;}
  const busca=(el('busca-vistorias-'+tipo)?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const lista=NF_VISTORIAS.filter(r=>tipo==='admin'||r.tecnico_id===SB_PROFILE.id).map(r=>({r,c:D.ch.find(c=>c.id===r.chamado_id)})).filter(({r,c})=>`${c?.pr||''} ${c?.si||''} ${sbNameById(r.tecnico_id)} ${r.nome_original}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(busca)).sort((a,b)=>b.r.criado_em.localeCompare(a.r.criado_em));
  box.innerHTML=lista.map(({r,c})=>`<div class="os"><strong>${esc(c?.pr||'Chamado registrado')} — ${esc(c?.si||'')}</strong><div class="os-r">Técnico: ${esc(sbNameById(r.tecnico_id)||'Técnico responsável')} • ${new Date(r.criado_em).toLocaleString('pt-BR')}</div><div class="os-r">${esc(r.nome_original)} • ${(r.tamanho_bytes/1024/1024).toFixed(2)} MB</div><button type="button" class="btn btn-p nf-baixar-vistoria" data-id="${esc(r.id)}">Baixar PDF</button></div>`).join('')||'<div class="empty">Nenhum relatório de vistoria encontrado.</div>';
 }
}
async function enviarVistoria(event){
 event.preventDefault();if(NF_ENVIANDO_VISTORIA)return;
 const file=el('vistoria-pdf').files[0],chamado=el('vistoria-chamado').value,btn=el('vistoria-enviar'),msg=el('vistoria-mensagem');
 let caminho='',registrado=false;
 NF_ENVIANDO_VISTORIA=true;btn.disabled=true;
 try{
  if(SB_PROFILE?.tipo!=='tecnico')throw new Error('Entre na área do técnico para anexar a vistoria.');
  if(!chamado||!file)throw new Error('Selecione o chamado e o arquivo PDF.');
  if(!/\.pdf$/i.test(file.name)||file.size===0||file.size>20*1024*1024)throw new Error('Selecione um PDF de até 20 MB.');
  if(!(await file.slice(0,1024).text()).includes('%PDF-'))throw new Error('O arquivo selecionado não é um PDF válido.');
  NF_ENVIANDO_VISTORIA=true;btn.disabled=true;msg.textContent='Enviando relatório...';
  const {data:{user},error:authError}=await SB.auth.getUser();if(authError||user?.id!==SB_PROFILE.id)throw new Error('Sua sessão mudou. Entre novamente.');
  const id=crypto.randomUUID();caminho=`${user.id}/${chamado}/${id}.pdf`;
  const {error:uploadError}=await SB.storage.from('relatorios-vistoria').upload(caminho,file,{contentType:'application/pdf',upsert:false});if(uploadError)throw uploadError;
  const {data,error}=await SB.from('relatorios_vistoria').insert({id,chamado_id:chamado,tecnico_id:user.id,caminho,nome_original:file.name,tamanho_bytes:file.size}).select().single();
  if(error)throw error;registrado=true;NF_VISTORIAS.push(data);
  el('vistoria-pdf').value='';msg.textContent='Relatório salvo. O administrador já pode baixar o PDF.';renderVistorias();
 }catch(err){
  // Em resposta de rede incerta, não apagar um PDF que pode ter sido registrado.
  if(caminho&&!registrado){try{const {data,error}=await SB.from('relatorios_vistoria').select('id').eq('caminho',caminho);if(!error&&!data.length)await SB.storage.from('relatorios-vistoria').remove([caminho]);}catch(_){}}
  msg.textContent='Não foi possível confirmar o envio: '+(err.message||'Erro de conexão. Atualize a lista antes de tentar novamente.');
 }finally{NF_ENVIANDO_VISTORIA=false;btn.disabled=false;}
}
async function baixarVistoria(id,botao){
 const r=NF_VISTORIAS.find(r=>r.id===id);if(!r)return;botao.disabled=true;
 try{const {data,error}=await SB.storage.from('relatorios-vistoria').download(r.caminho);if(error)throw error;
  const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=r.nome_original;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(err){sbShowError('Não foi possível baixar o PDF',err);}finally{botao.disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
 el('form-vistoria').addEventListener('submit',enviarVistoria);
 for(const tipo of ['admin','tecnico'])el('busca-vistorias-'+tipo).addEventListener('input',renderVistorias);
 document.addEventListener('click',e=>{const restaurar=e.target.closest('.nf-restaurar-ch'),baixar=e.target.closest('.nf-baixar-vistoria');if(restaurar)alterarArquivoChamado(restaurar.dataset.id,true);if(baixar)baixarVistoria(baixar.dataset.id,baixar);});
});
