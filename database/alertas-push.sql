create schema if not exists nf_push_private;
revoke all on schema nf_push_private from public, anon, authenticated;
create table nf_push_private.config(id boolean primary key default true check(id), public_key text not null, private_key text not null, hook_token text not null);
alter table nf_push_private.config enable row level security;
create table public.tecnico_push_subscriptions(endpoint text primary key, tecnico_id uuid not null references public.perfis(id) on delete cascade, subscription jsonb not null, criado_em timestamptz not null default now());
alter table public.tecnico_push_subscriptions enable row level security;
create policy push_proprio on public.tecnico_push_subscriptions for all to authenticated using(tecnico_id=auth.uid()) with check(tecnico_id=auth.uid() and exists(select 1 from public.perfis where id=auth.uid() and tipo='tecnico' and ativo));
grant select,insert,update,delete on public.tecnico_push_subscriptions to authenticated;
grant all on public.tecnico_push_subscriptions to service_role;
create table public.tecnico_push_eventos(id uuid primary key default gen_random_uuid(), chamado_id uuid references public.chamados(id) on delete cascade, tecnico_id uuid not null references public.perfis(id), payload jsonb not null, status text not null default 'pendente', tentativas integer not null default 0, criado_em timestamptz default now(), enviado_em timestamptz, atualizado_em timestamptz default now(), erro text);
alter table public.tecnico_push_eventos enable row level security;
revoke all on public.tecnico_push_eventos from anon,authenticated;
grant all on public.tecnico_push_eventos to service_role;
create or replace function public.nf_push_config() returns jsonb language sql security definer set search_path='' as $$ select jsonb_build_object('publicKey',public_key,'privateKey',private_key,'hookToken',hook_token) from nf_push_private.config where id $$;
revoke all on function public.nf_push_config() from public,anon,authenticated;
grant execute on function public.nf_push_config() to service_role;
create or replace function public.nf_push_public_key() returns text language sql security definer set search_path='' as $$ select public_key from nf_push_private.config where id and exists(select 1 from public.perfis where id=auth.uid() and tipo='tecnico' and ativo) $$;
revoke all on function public.nf_push_public_key() from public,anon;
grant execute on function public.nf_push_public_key() to authenticated;
create or replace function nf_push_private.dispatch() returns void language plpgsql security definer set search_path='' as $$
declare token text; evento record;
begin
select hook_token into token from nf_push_private.config where id;
for evento in select id from public.tecnico_push_eventos where (status in ('pendente','erro') or (status='enviando' and atualizado_em<now()-interval '2 minutes')) and tentativas<5 and criado_em>now()-interval '1 hour' loop
perform net.http_post(url:='https://hxbuoqxojwpsreakmfdc.supabase.co/functions/v1/tecnico-push',headers:=jsonb_build_object('Content-Type','application/json','x-nf-push-token',token),body:=jsonb_build_object('eventId',evento.id),timeout_milliseconds:=15000);
end loop;
end $$;
revoke all on function nf_push_private.dispatch() from public,anon,authenticated;
create or replace function nf_push_private.on_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
if new.tecnico_id is not null and new.status='pendente' and (TG_OP='INSERT' or old.tecnico_id is distinct from new.tecnico_id or old.status is distinct from new.status) then
insert into public.tecnico_push_eventos(chamado_id,tecnico_id,payload) values(new.id,new.tecnico_id,jsonb_build_object('title','Novo chamado recebido','body','Protocolo '||coalesce(new.protocolo,'—')||' · '||coalesce(new.site_nome,'Atividade técnica'),'chamadoId',new.id,'url','/?chamado='||new.id));
perform nf_push_private.dispatch();
end if;
return new;
exception when others then raise warning 'Alerta push não enfileirado: %',sqlerrm; return new;
end $$;
revoke all on function nf_push_private.on_assignment() from public,anon,authenticated;
create trigger nf_push_assignment after insert or update of tecnico_id,status on public.chamados for each row execute function nf_push_private.on_assignment();
select cron.schedule('nf-push-retry','* * * * *','select nf_push_private.dispatch()');

create or replace function public.nf_push_claim(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
with claimed as (update public.tecnico_push_eventos set status='enviando',tentativas=tentativas+1,atualizado_em=now() where id=p_id and tentativas<5 and (status in ('pendente','erro') or (status='enviando' and atualizado_em<now()-interval '2 minutes')) returning *) select to_jsonb(claimed) from claimed;
$$;
revoke all on function public.nf_push_claim(uuid) from public,anon,authenticated;
grant execute on function public.nf_push_claim(uuid) to service_role;
