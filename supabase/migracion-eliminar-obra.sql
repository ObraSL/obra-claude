-- Borrado DEFINITIVO de una obra (a petición explícita del dueño, 28/09/2026).
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.
--
-- El punto 5 (ON DELETE RESTRICT) sigue protegiendo contra un borrado
-- accidental desde el Table Editor o el SQL Editor. Esta función es la
-- única puerta pensada para borrar de verdad: exige ser el dueño, borra
-- todo lo de la obra en el orden correcto (respetando esas mismas
-- restricciones) y es irreversible. La app pide, antes de llamarla, escribir
-- el nombre de la obra y la contraseña de la cuenta — eso ya lo hace la app,
-- no esta función.
--
-- Nota: esto NO borra los archivos (fotos de recibos, audios) del Storage —
-- eso lo hace la app justo antes de llamar a esta función, porque el
-- Storage no se toca desde SQL.

create or replace function public.eliminar_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede borrar una obra definitivamente.';
  end if;

  if not exists (select 1 from public.obras where id = p_obra_id and owner_id = public.owner_empresa()) then
    raise exception 'Esa obra no existe o no es de esta empresa.';
  end if;

  -- Referencias de "antes/después" en el historial de OTRAS obras que un día
  -- movieron un fichaje hacia o desde esta: se limpia el nombre, no el dato.
  update public.fichajes_historial set obra_id_antes = null where obra_id_antes = p_obra_id;
  update public.fichajes_historial set obra_id_despues = null where obra_id_despues = p_obra_id;

  -- El historial propio de los fichajes de esta obra.
  delete from public.fichajes_historial
   where fichaje_id in (select id from public.fichajes where obra_id = p_obra_id);

  delete from public.fichajes where obra_id = p_obra_id;
  delete from public.usos_vehiculo where obra_id = p_obra_id;
  delete from public.gastos where obra_id = p_obra_id;
  delete from public.facturas where obra_id = p_obra_id;
  delete from public.cobros where obra_id = p_obra_id;
  delete from public.notas_audio where obra_id = p_obra_id;
  delete from public.tareas where obra_id = p_obra_id;

  -- entregas.obra_id y miembros.obra_id ya son "on delete set null": se
  -- limpian solos al borrar la obra, sin tocar esas filas.
  delete from public.obras where id = p_obra_id;
end;
$$;
