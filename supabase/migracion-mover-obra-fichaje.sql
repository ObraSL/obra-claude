-- Punto 4: mover un fichaje ya hecho a la obra correcta, cuando fue un error
-- del día (se fichó en la obra equivocada) — no para trasladar de verdad al
-- trabajador a mitad de turno. Las horas no cambian, solo la obra a la que
-- pertenecen. Se guarda en el mismo historial de correcciones.
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

alter table public.fichajes_historial
  add column if not exists obra_id_antes uuid references public.obras (id),
  add column if not exists obra_id_despues uuid references public.obras (id);

create or replace function public.registrar_correccion_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.hora_corregida then
      insert into public.fichajes_historial
        (fichaje_id, obra_id, trabajador_id, fecha,
         hora_entrada_antes, hora_salida_antes,
         hora_entrada_despues, hora_salida_despues, cambiado_por)
      values
        (new.id, new.obra_id, new.trabajador_id, new.fecha,
         null, null, new.hora_entrada, new.hora_salida, auth.uid());
      new.confirmado_trabajador := false;
    end if;
    return new;
  end if;

  if old.hora_entrada is distinct from new.hora_entrada
     or old.hora_salida is distinct from new.hora_salida
     or old.obra_id is distinct from new.obra_id then
    insert into public.fichajes_historial
      (fichaje_id, obra_id, trabajador_id, fecha,
       hora_entrada_antes, hora_salida_antes,
       hora_entrada_despues, hora_salida_despues,
       obra_id_antes, obra_id_despues, cambiado_por)
    values
      (new.id, new.obra_id, new.trabajador_id, new.fecha,
       old.hora_entrada, old.hora_salida, new.hora_entrada, new.hora_salida,
       case when old.obra_id is distinct from new.obra_id then old.obra_id end,
       case when old.obra_id is distinct from new.obra_id then new.obra_id end,
       auth.uid());
    new.confirmado_trabajador := false;
  end if;

  return new;
end;
$$;
