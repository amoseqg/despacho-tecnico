import fs from 'node:fs';
import vm from 'node:vm';

const inicio=Number(process.argv[2]||0);
const tamanho=Number(process.argv[3]||150);
const partes=['app.part1','app.part2','app.part3'].map(arquivo=>fs.readFileSync(arquivo,'utf8'));
for(let i=0;i<partes.length-1;i++)if(partes[i].endsWith('\n'))partes[i]=partes[i].slice(0,-1);
const fonte=partes.join('');
const marca='const SITES_PEII = ';
const comeco=fonte.indexOf(marca)+marca.length;
let profundidade=0,emTexto=false,escapado=false,fim=-1;
for(let i=comeco;i<fonte.length;i++){
  const caractere=fonte[i];
  if(emTexto){if(escapado)escapado=false;else if(caractere.charCodeAt(0)===92)escapado=true;else if(caractere==='"')emTexto=false;continue;}
  if(caractere==='"'){emTexto=true;continue;}
  if(caractere==='[')profundidade++;
  else if(caractere===']'&&--profundidade===0){fim=i+1;break;}
}
if(fim<0)throw new Error('Base SITES_PEII incompleta.');
const todos=vm.runInNewContext('('+fonte.slice(comeco,fim)+')',Object.create(null),{timeout:2000});
const linhas=todos.slice(inicio,inicio+tamanho).map(x=>({
  circuito:String(x[0]||'').trim(),site:String(x[1]||'').trim(),cidade:String(x[2]||'').trim()||null,
  endereco:String(x[3]||'').trim()||null,contato:String(x[4]||'').trim()||null,horario_expediente:String(x[5]||'').trim()||null,
  velocidade:String(x[6]||'').trim()||null,prtm:String(x[7]||'').trim()||null,pvf_total:Number(x[8])||null,
  regiao_operacional:String(x[9]||'').trim()||null,tecnicos_indicados:String(x[10]||'').trim()||null
}));
const json=JSON.stringify(linhas);
process.stdout.write(`insert into public.sites (circuito,site,cidade,endereco,contato,horario_expediente,velocidade,prtm,pvf_total,regiao_operacional,tecnicos_indicados,ativo,atualizado_em)\nselect x.circuito,x.site,x.cidade,x.endereco,x.contato,x.horario_expediente,x.velocidade,x.prtm,x.pvf_total,x.regiao_operacional,x.tecnicos_indicados,true,now()\nfrom jsonb_to_recordset($sites$${json}$sites$::jsonb) as x(circuito text,site text,cidade text,endereco text,contato text,horario_expediente text,velocidade text,prtm text,pvf_total integer,regiao_operacional text,tecnicos_indicados text)\non conflict (circuito) do update set site=excluded.site,cidade=excluded.cidade,endereco=excluded.endereco,contato=excluded.contato,horario_expediente=excluded.horario_expediente,velocidade=excluded.velocidade,prtm=excluded.prtm,pvf_total=excluded.pvf_total,regiao_operacional=excluded.regiao_operacional,tecnicos_indicados=excluded.tecnicos_indicados,ativo=true,atualizado_em=now();`);
