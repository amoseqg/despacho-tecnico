/* Rastreamento operacional: ativo somente durante chamados aceitos. */
let NF_RASTREAMENTO=new Map();
let NF_GEO_WATCHES=new Map();
let NF_GEO_ULTIMO_ENVIO=new Map();

function localizacaoChamadoHtml(c){
 const p=NF_RASTREAMENTO.get(c.id);
 if(!p)return '<span class="badge b-pendente" title="Aguardando o técnico autorizar a localização">📍 Aguardando localização</span>';
 const quando=new Date(p.registrado_em).toLocaleString('pt-BR');
 return `<button type="button" class="btn btn-g nf-ver-localizacao" data-id="${esc(c.id)}" style="padding:4px 7px;font-size:.6rem" title="Última atualização: ${esc(quando)}">📍 Rastrear técnico</button>`;
}

function statusRastreamentoTecnicoHtml(c){
 const ativo=NF_GEO_WATCHES.has(c.id);
 return `<div class="${ativo?'info':'trava'}" style="margin-top:8px"><b>📍 Rastreamento:</b> ${ativo?'ativo durante este atendimento':'aguardando autorização de localização'}</div>`;
}

async function carregarRastreamentoTecnicos(){
 if(!SB_PROFILE)return;
 const {data,error}=await SB.from('rastreamento_tecnico').select('*').order('registrado_em',{ascending:false}).limit(500);
 if(error){console.warn('Rastreamento indisponível:',error.message);return;}
 const mapa=new Map();for(const p of data||[])if(!mapa.has(p.chamado_id))mapa.set(p.chamado_id,p);
 NF_RASTREAMENTO=mapa;
 if(S?.t==='adm')rAt();
}

async function registrarPosicaoChamado(chamadoId,posicao){
 const c=D.ch.find(x=>x.id===chamadoId);
 if(!c||c.st!=='andamento'||SB_PROFILE?.tipo!=='tecnico'){pararRastreamentoTecnico(chamadoId);return;}
 const agora=Date.now(),ultimo=NF_GEO_ULTIMO_ENVIO.get(chamadoId)||0;
 if(agora-ultimo<30000)return;
 NF_GEO_ULTIMO_ENVIO.set(chamadoId,agora);
 const linha={chamado_id:chamadoId,tecnico_id:SB_PROFILE.id,latitude:posicao.coords.latitude,longitude:posicao.coords.longitude,precisao_metros:posicao.coords.accuracy,registrado_em:new Date(posicao.timestamp||agora).toISOString()};
 const {data,error}=await SB.from('rastreamento_tecnico').insert(linha).select('*').single();
 if(error){NF_GEO_ULTIMO_ENVIO.delete(chamadoId);console.warn('Não foi possível atualizar a localização:',error.message);return;}
 NF_RASTREAMENTO.set(chamadoId,data);rTat();
}

function iniciarRastreamentoTecnico(chamadoId){
 if(NF_GEO_WATCHES.has(chamadoId))return;
 if(!navigator.geolocation){alert('Este aparelho não oferece localização pelo navegador. O chamado foi aceito, mas o administrador verá a localização como indisponível.');return;}
 const watch=navigator.geolocation.watchPosition(
  pos=>void registrarPosicaoChamado(chamadoId,pos),
  erro=>{console.warn('Localização não autorizada:',erro.message);alert('O chamado foi aceito, mas a localização não foi autorizada. Ative a permissão de localização do NexoField no navegador para permitir o rastreamento.');pararRastreamentoTecnico(chamadoId);},
  {enableHighAccuracy:true,maximumAge:15000,timeout:20000}
 );
 NF_GEO_WATCHES.set(chamadoId,watch);rTat();
}

function pararRastreamentoTecnico(chamadoId){
 const watch=NF_GEO_WATCHES.get(chamadoId);if(watch!==undefined&&navigator.geolocation)navigator.geolocation.clearWatch(watch);
 NF_GEO_WATCHES.delete(chamadoId);NF_GEO_ULTIMO_ENVIO.delete(chamadoId);
}

acCh=async function(id){
 const c=D.ch.find(x=>x.id===id);if(!c||SB_PROFILE?.tipo!=='tecnico')return;
 if(!confirm('Ao aceitar, o NexoField solicitará sua localização e manterá o rastreamento ativo somente durante este atendimento. Deseja continuar?'))return;
 const agora=new Date().toISOString();
 try{
  const {data,error}=await SB.from('chamados').update({status:'andamento',aceito_em:agora,iniciado_em:agora,atualizado_em:agora}).eq('id',id).eq('tecnico_id',SB_PROFILE.id).select('id,status,aceito_em,iniciado_em').single();
  if(error)throw error;if(data?.status!=='andamento')throw new Error('O servidor não confirmou o aceite.');
  c.st='andamento';c.ae=data.aceito_em;c.am=data.iniciado_em;lsSet('dd',D);rTdp();rTdb();rTat();
  iniciarRastreamentoTecnico(id);alert('Chamado aceito! Timer e rastreamento iniciados.');
 }catch(err){sbShowError('Não foi possível aceitar o chamado',err);}
};

document.addEventListener('click',e=>{
 const btn=e.target.closest('.nf-ver-localizacao');if(!btn)return;
 const p=NF_RASTREAMENTO.get(btn.dataset.id);if(!p){alert('O técnico ainda não compartilhou uma localização.');return;}
 window.open(`https://www.google.com/maps?q=${encodeURIComponent(p.latitude+','+p.longitude)}`,'_blank','noopener');
});

document.addEventListener('DOMContentLoaded',()=>{
 setInterval(()=>{if(SB_PROFILE&&document.visibilityState!=='hidden')void carregarRastreamentoTecnicos();},15000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&SB_PROFILE)void carregarRastreamentoTecnicos();});
});
