-- Encerramento técnico segue diretamente para aprovação administrativa.
create or replace function public.exigir_validacao_operador_antes_conclusao()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    if not (select public.usuario_e_admin())
       and (new.tecnico_id is null or new.tecnico_id is distinct from (select auth.uid())) then
      raise exception 'Somente o técnico responsável ou um administrador pode encerrar este chamado.';
    end if;
  end if;
  return new;
end;
$$;
comment on function public.exigir_validacao_operador_antes_conclusao() is
  'Autoriza o encerramento pelo técnico responsável ou administrador sem exigir validação do operador. A aprovação permanece exclusiva do administrador.';
