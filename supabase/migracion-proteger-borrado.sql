-- Prohíbe el borrado en cascada: hasta ahora, borrar una obra, un trabajador
-- o un vehículo borraba automáticamente y sin aviso todos sus fichajes,
-- gastos, facturas, cobros, notas de audio, tareas y usos de vehículo.
-- Pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo. Lo mismo está en schema.sql.
--
-- A partir de ahora, Postgres se niega a borrar el "padre" mientras tenga
-- datos colgando: hay que vaciarlos o pasarlos antes. La app no cambia en
-- nada, porque nunca borra obras/trabajadores/vehículos de verdad — solo los
-- desactiva (activa/activo). Esto solo cierra la puerta a un borrado
-- accidental desde el Table Editor o el SQL Editor de Supabase.

do $$
declare
  r record;
  fk_name text;
begin
  for r in
    select * from (values
      ('fichajes', 'obra_id', 'obras'),
      ('fichajes', 'trabajador_id', 'trabajadores'),
      ('usos_vehiculo', 'obra_id', 'obras'),
      ('usos_vehiculo', 'vehiculo_id', 'vehiculos'),
      ('gastos', 'obra_id', 'obras'),
      ('facturas', 'obra_id', 'obras'),
      ('cobros', 'obra_id', 'obras'),
      ('notas_audio', 'obra_id', 'obras'),
      ('tareas', 'obra_id', 'obras')
    ) as t(tabla, columna, referencia)
  loop
    select con.conname into fk_name
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
     where con.conrelid = format('public.%I', r.tabla)::regclass
       and con.contype = 'f'
       and a.attname = r.columna
       and array_length(con.conkey, 1) = 1;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', r.tabla, fk_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete restrict',
      r.tabla, r.tabla || '_' || r.columna || '_fkey', r.columna, r.referencia
    );
  end loop;
end $$;
