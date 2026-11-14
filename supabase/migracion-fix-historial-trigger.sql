-- Arregla un fallo real encontrado probando "Corregir horas": al corregir un
-- fichaje que YA existía, salía "insert or update on table fichajes_historial
-- violates foreign key constraint". Pega este archivo entero en Supabase →
-- SQL Editor → Run. Es seguro volver a ejecutarlo. Lo mismo está en schema.sql.
--
-- Causa: el guardado usa upsert (insert con "on conflict"). Postgres dispara
-- el trigger BEFORE INSERT igual aunque el conflicto lo acabe convirtiendo en
-- un UPDATE — y en ese momento new.id es el de una fila que nunca llega a
-- existir de verdad. Insertar en fichajes_historial desde ahí rompía su
-- clave foránea. Arreglo: el historial se escribe en un trigger AFTER, que
-- solo ve lo que realmente pasó (inserción o actualización de verdad).

create or replace function public.registrar_correccion_fichaje()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.hora_corregida then
      new.confirmado_trabajador := false;
    end if;
    return new;
  end if;

  if old.hora_entrada is distinct from new.hora_entrada
     or old.hora_salida is distinct from new.hora_salida
     or old.obra_id is distinct from new.obra_id then
    new.confirmado_trabajador := false;
  end if;

  return new;
end;
$$;

create or replace function public.registrar_historial_fichaje()
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
    end if;
    return null;
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
  end if;

  return null;
end;
$$;

drop trigger if exists registrar_historial_fichaje on public.fichajes;
create trigger registrar_historial_fichaje
  after insert or update on public.fichajes
  for each row execute function public.registrar_historial_fichaje();
