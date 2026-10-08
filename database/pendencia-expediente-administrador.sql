begin;
create table public.pendencias_expediente_admin (
 id uuid primary key default gen_random_uuid(), chamado_id uuid not null references public.chamados(id),
 administrador_id uuid not null references public.perfis(id), administrador_nome text not null,
 motivo text not null check(length(trim(motivo)) between 3 and 2000),
 inicio_expediente time not null, fim_expediente time not null,
 dias_expediente integer[] not null, dias_sem_expediente date[] not null default '{}',
 retorno_em timestamptz not null, prazo_restante_segundos bigint not null check(prazo_restante_segundos>0),
 vencimento_anterior timestamptz, vencimento_reprogramado timestamptz not null,
 criado_em timestamptz not null default now(), liberado_em timestamptz,
 liberado_por uuid references public.perfis(id),status text not null default 'pausado' check(status in ('pausado','liberado','finalizado')),
 check(inicio_expediente<fim_expediente),check(cardinality(dias_expediente)>0 and dias_expediente<@array[0,1,2,3,4,5,6])
);
create unique index pendencia_expediente_unica on public.pendencias_expediente_admin(chamado_id) where status='pausado';
create index pendencia_expediente_retorno on public.pendencias_expediente_admin(retorno_em) where status='pausado';
alter table public.pendencias_expediente_admin enable row level security;
grant select,insert,update on public.pendencias_expediente_admin to authenticated;
create policy expediente_admin_select on public.pendencias_expediente_admin for select to authenticated using ((select public.usuario_e_admin()) or exists(select 1 from public.chamados c where c.id=chamado_id and c.tecnico_id=auth.uid()));
create policy expediente_admin_insert on public.pendencias_expediente_admin for insert to authenticated with check ((select public.usuario_e_admin()) and administrador_id=auth.uid());
create policy expediente_admin_update on public.pendencias_expediente_admin for update to authenticated using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));
grant usage on schema privado to authenticated;
create or replace function privado.expediente_valido(p_data timestamptz,p_inicio time,p_fim time,p_dias integer[],p_feriados date[],p_segundos bigint)
returns boolean language sql stable security invoker set search_path='' as $$
 select extract(dow from p_data at time zone 'America/Sao_Paulo')::integer=any(p_dias)
 and not ((p_data at time zone 'America/Sao_Paulo')::date=any(p_feriados))
 and (p_data at time zone 'America/Sao_Paulo')::time>=p_inicio
 and (p_data at time zone 'America/Sao_Paulo')::time<p_fim
 and (p_data+make_interval(secs=>p_segundos::double precision)) <= (((p_data at time zone 'America/Sao_Paulo')::date+p_fim) at time zone 'America/Sao_Paulo');
$$;
revoke all on function privado.expediente_valido(timestamptz,time,time,integer[],date[],bigint) from public;
grant execute on function privado.expediente_valido(timestamptz,time,time,integer[],date[],bigint) to authenticated;
create or replace function public.pendenciar_expediente_admin(p_chamado_id uuid,p_retorno timestamptz,p_inicio time,p_fim time,p_dias integer[],p_feriados date[],p_motivo text)
returns public.pendencias_expediente_admin language plpgsql security invoker set search_path='' as $$
declare c public.chamados; a public.perfis; r public.pendencias_expediente_admin; restante bigint; limite timestamptz;
begin
 select * into a from public.perfis where id=auth.uid() and tipo='admin' and ativo;
 if a.id is null then raise exception 'Somente administrador ativo pode pendenciar.' using errcode='42501'; end if;
 if p_retorno is null or p_retorno<=now() or p_inicio is null or p_fim is null or p_inicio>=p_fim or p_dias is null or cardinality(p_dias)=0 or not p_dias<@array[0,1,2,3,4,5,6] or p_feriados is null or length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Informe retorno futuro, expediente, dias válidos e motivo.'; end if;
 select * into c from public.chamados where id=p_chamado_id for update;
 if c.id is null or c.status not in ('aberto','pendente','andamento') then raise exception 'Chamado não está ativo.'; end if;
 if c.pendencia_ativa or exists(select 1 from public.solicitacoes_pendencia where chamado_id=c.id and status in ('solicitada','aprovada')) then raise exception 'Este chamado já possui uma pendência.'; end if;
 limite:=coalesce(c.vencimento_em,coalesce(c.iniciado_em,c.aceito_em,c.criado_em)+case when c.regiao='interior' then interval '8 hours' else interval '6 hours' end+make_interval(secs=>c.prazo_pausado_segundos::double precision));
 restante:=floor(extract(epoch from limite-now()))::bigint;
 if restante<=0 then raise exception 'O prazo já venceu. A pendência não remove uma perda de prazo anterior.'; end if;
 if not privado.expediente_valido(p_retorno,p_inicio,p_fim,p_dias,p_feriados,restante) then raise exception 'Escolha retorno em dia de expediente, com tempo restante suficiente até o fechamento. Confira os feriados informados.'; end if;
 insert into public.pendencias_expediente_admin(chamado_id,administrador_id,administrador_nome,motivo,inicio_expediente,fim_expediente,dias_expediente,dias_sem_expediente,retorno_em,prazo_restante_segundos,vencimento_anterior,vencimento_reprogramado)
 values(c.id,a.id,a.nome,trim(p_motivo),p_inicio,p_fim,p_dias,p_feriados,p_retorno,restante,c.vencimento_em,p_retorno+make_interval(secs=>restante::double precision)) returning * into r;
 update public.chamados set pendencia_ativa=true,pendencia_desde=now(),vencimento_em=r.vencimento_reprogramado,atualizado_em=now() where id=c.id;
 return r;
end $$;
create or replace function public.liberar_expediente_admin(p_pendencia_id uuid)
returns public.pendencias_expediente_admin language plpgsql security invoker set search_path='' as $$
declare r public.pendencias_expediente_admin; c public.chamados;
begin
 if not exists(select 1 from public.perfis where id=auth.uid() and tipo='admin' and ativo) then raise exception 'Somente administrador ativo pode liberar.' using errcode='42501'; end if;
 select c1.* into c from public.chamados c1 join public.pendencias_expediente_admin p on p.chamado_id=c1.id where p.id=p_pendencia_id for update of c1;
 select * into r from public.pendencias_expediente_admin where id=p_pendencia_id for update;
 if r.id is null or r.status<>'pausado' or not c.pendencia_ativa or c.status not in ('aberto','pendente','andamento') then raise exception 'Pendência não está ativa.'; end if;
 if not privado.expediente_valido(now(),r.inicio_expediente,r.fim_expediente,r.dias_expediente,r.dias_sem_expediente,r.prazo_restante_segundos) then raise exception 'Liberação permitida somente em dia de expediente e com tempo suficiente antes do fechamento.'; end if;
 update public.chamados set pendencia_ativa=false,pendencia_desde=null,prazo_pausado_segundos=prazo_pausado_segundos+greatest(0,floor(extract(epoch from now()-c.pendencia_desde)))::bigint,vencimento_em=now()+make_interval(secs=>r.prazo_restante_segundos::double precision),atualizado_em=now() where id=c.id;
 update public.pendencias_expediente_admin set status='liberado',liberado_em=now(),liberado_por=auth.uid(),vencimento_reprogramado=now()+make_interval(secs=>r.prazo_restante_segundos::double precision) where id=r.id returning * into r;
 return r;
end $$;
revoke all on function public.pendenciar_expediente_admin(uuid,timestamptz,time,time,integer[],date[],text) from public,anon;
revoke all on function public.liberar_expediente_admin(uuid) from public,anon;
grant execute on function public.pendenciar_expediente_admin(uuid,timestamptz,time,time,integer[],date[],text) to authenticated;
grant execute on function public.liberar_expediente_admin(uuid) to authenticated;
create or replace function privado.liberar_expedientes_programados() returns integer language plpgsql security invoker set search_path='' as $$
declare r public.pendencias_expediente_admin;c public.chamados;data_local date;proximo timestamptz;n integer:=0;i integer;
begin
 for r in select * from public.pendencias_expediente_admin where status='pausado' and retorno_em<=now() loop
  select * into c from public.chamados where id=r.chamado_id for update;
  select * into r from public.pendencias_expediente_admin where id=r.id and status='pausado' for update;
  if r.id is null then continue; end if;
  if c.status not in ('aberto','pendente','andamento') then
   update public.pendencias_expediente_admin set status='finalizado',liberado_em=now() where id=r.id;
   update public.chamados set pendencia_ativa=false,prazo_pausado_segundos=prazo_pausado_segundos+greatest(0,floor(extract(epoch from coalesce(c.concluido_em,now())-c.pendencia_desde)))::bigint,pendencia_desde=null where id=c.id;
   continue;
  end if;
  if privado.expediente_valido(now(),r.inicio_expediente,r.fim_expediente,r.dias_expediente,r.dias_sem_expediente,r.prazo_restante_segundos) then
   update public.chamados set pendencia_ativa=false,pendencia_desde=null,prazo_pausado_segundos=prazo_pausado_segundos+greatest(0,floor(extract(epoch from now()-c.pendencia_desde)))::bigint,vencimento_em=now()+make_interval(secs=>r.prazo_restante_segundos::double precision),atualizado_em=now() where id=c.id;
   update public.pendencias_expediente_admin set status='liberado',liberado_em=now(),vencimento_reprogramado=now()+make_interval(secs=>r.prazo_restante_segundos::double precision) where id=r.id;n:=n+1;
  else
   data_local:=(now() at time zone 'America/Sao_Paulo')::date;
   for i in 0..370 loop
    proximo:=((data_local+i+r.inicio_expediente) at time zone 'America/Sao_Paulo');
    if proximo>now() and privado.expediente_valido(proximo,r.inicio_expediente,r.fim_expediente,r.dias_expediente,r.dias_sem_expediente,r.prazo_restante_segundos) then exit; end if;
   end loop;
   if proximo>now() and privado.expediente_valido(proximo,r.inicio_expediente,r.fim_expediente,r.dias_expediente,r.dias_sem_expediente,r.prazo_restante_segundos) then
    update public.pendencias_expediente_admin set retorno_em=proximo,vencimento_reprogramado=proximo+make_interval(secs=>r.prazo_restante_segundos::double precision) where id=r.id;
    update public.chamados set vencimento_em=proximo+make_interval(secs=>r.prazo_restante_segundos::double precision) where id=c.id;
   end if;
  end if;
 end loop;return n;
end $$;
revoke all on function privado.liberar_expedientes_programados() from public,anon,authenticated;

create or replace function privado.impedir_pendencias_simultaneas() returns trigger language plpgsql security invoker set search_path='' as $$
declare ativa boolean;
begin
 select pendencia_ativa into ativa from public.chamados where id=new.chamado_id for update;
 if ativa then raise exception 'Este chamado já possui uma pendência ativa.';end if;
 return new;
end $$;
revoke all on function privado.impedir_pendencias_simultaneas() from public;
create trigger impedir_pendencias_simultaneas before insert on public.solicitacoes_pendencia for each row execute function privado.impedir_pendencias_simultaneas();
select cron.schedule('nexofield-expediente-admin','* * * * *','select privado.liberar_expedientes_programados()');
alter publication supabase_realtime add table public.pendencias_expediente_admin;
commit;
