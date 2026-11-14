-- Complemento al punto 5: hasta ahora, borrar la CUENTA del dueño (por
-- ejemplo desde Supabase → Authentication → Users) borraba en cascada TODA
-- la empresa: obras, trabajadores, vehículos, proveedores, entregas y
-- ajustes. Con la corrección anterior (migracion-proteger-borrado.sql) ya
-- no se puede borrar una obra/trabajador/vehículo con datos colgando, pero
-- estas seis tablas seguían colgando directamente de la cuenta del dueño.
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

do $$
declare
  r record;
  fk_name text;
begin
  for r in
    select * from (values
      ('obras'), ('trabajadores'), ('vehiculos'),
      ('proveedores'), ('entregas'), ('ajustes')
    ) as t(tabla)
  loop
    select con.conname into fk_name
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
     where con.conrelid = format('public.%I', r.tabla)::regclass
       and con.contype = 'f'
       and a.attname = 'owner_id'
       and array_length(con.conkey, 1) = 1;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', r.tabla, fk_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (owner_id) references auth.users (id) on delete restrict',
      r.tabla, r.tabla || '_owner_id_fkey'
    );
  end loop;
end $$;
