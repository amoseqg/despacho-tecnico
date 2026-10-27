create or replace function private.historico_reincidencia_tecnico(p_chamado_id uuid, p_usuario_id uuid)
returns table(
  chamado_anterior_id uuid,
  protocolo_anterior text,
  tecnico_anterior text,
  concluido_em timestamptz,
  acao_realizada text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select anterior.id,
         anterior.protocolo,
         perfil.nome,
         anterior.concluido_em,
         coalesce(nullif(execucao.observacao, ''),
                  nullif(execucao.relatorio_encerramento, ''),
                  nullif(execucao.atividade, ''),
                  'Ação não informada')
  from public.chamados atual
  join public.chamados anterior
    on anterior.id <> atual.id
   and anterior.status = 'concluida'
   and anterior.concluido_em is not null
   and anterior.concluido_em <= atual.criado_em
   and atual.criado_em - anterior.concluido_em < interval '30 days'
   and (
     (
       lower(translate(coalesce(atual.skill, ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) = 'voz'
       and regexp_replace(lower(translate(coalesce(nullif(atual.operadora, ''), nullif(atual.abertura_origem, ''), ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]', '', 'g') in ('vectra', 'metodo')
       and lower(translate(coalesce(anterior.skill, ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) = 'voz'
       and regexp_replace(lower(translate(coalesce(nullif(anterior.operadora, ''), nullif(anterior.abertura_origem, ''), ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]', '', 'g') in ('vectra', 'metodo')
       and (
         (
           length(regexp_replace(coalesce(atual.numero_ramal, ''), '[^0-9]', '', 'g')) > 0
           and length(regexp_replace(coalesce(anterior.numero_ramal, ''), '[^0-9]', '', 'g')) > 0
           and regexp_replace(coalesce(atual.numero_ramal, ''), '[^0-9]', '', 'g')
             = regexp_replace(coalesce(anterior.numero_ramal, ''), '[^0-9]', '', 'g')
         )
         or (
           (
             length(regexp_replace(coalesce(atual.numero_ramal, ''), '[^0-9]', '', 'g')) = 0
             or length(regexp_replace(coalesce(anterior.numero_ramal, ''), '[^0-9]', '', 'g')) = 0
           )
           and length(regexp_replace(coalesce(atual.circuito, ''), '[^0-9]', '', 'g')) > 0
           and regexp_replace(coalesce(atual.circuito, ''), '[^0-9]', '', 'g')
             = regexp_replace(coalesce(anterior.circuito, ''), '[^0-9]', '', 'g')
         )
       )
     )
     or (
       not (
         lower(translate(coalesce(atual.skill, ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) = 'voz'
         and regexp_replace(lower(translate(coalesce(nullif(atual.operadora, ''), nullif(atual.abertura_origem, ''), ''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]', '', 'g') in ('vectra', 'metodo')
       )
       and length(regexp_replace(coalesce(atual.circuito, ''), '[^0-9]', '', 'g')) > 0
       and regexp_replace(coalesce(atual.circuito, ''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(anterior.circuito, ''), '[^0-9]', '', 'g')
     )
   )
  left join public.perfis perfil on perfil.id = anterior.tecnico_id
  left join public.execucoes execucao on execucao.chamado_id = anterior.id
  where atual.id = p_chamado_id
    and p_usuario_id is not null
    and p_usuario_id = auth.uid()
    and atual.tecnico_id = p_usuario_id
  order by anterior.concluido_em desc
  limit 1;
$function$;
