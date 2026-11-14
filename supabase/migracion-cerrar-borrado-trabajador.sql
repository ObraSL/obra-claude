-- Punto 11 del plan: se comprobó que la política "fichajes propios" estaba
-- escrita como "for all", que en Postgres incluye DELETE — es decir, un
-- trabajador podía borrar su propio fichaje (por ejemplo, para esconder un
-- retraso). Se cierra separando la política en select/insert/update: sin una
-- política que permita DELETE al trabajador, Postgres lo deniega por
-- defecto. El dueño y los gestores siguen pudiendo borrar (otra política
-- aparte, "fichajes gestores").
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

drop policy if exists "fichajes propios" on public.fichajes;

create policy "fichajes propios select" on public.fichajes
  for select using (
    public.mi_rol() = 'trabajador'
    and trabajador_id = public.mi_trabajador_id()
    and public.puede_ver_obra(obra_id)
  );

create policy "fichajes propios insert" on public.fichajes
  for insert with check (
    public.mi_rol() = 'trabajador'
    and trabajador_id = public.mi_trabajador_id()
    and public.puede_ver_obra(obra_id)
  );

create policy "fichajes propios update" on public.fichajes
  for update using (
    public.mi_rol() = 'trabajador'
    and trabajador_id = public.mi_trabajador_id()
    and public.puede_ver_obra(obra_id)
  )
  with check (
    public.mi_rol() = 'trabajador'
    and trabajador_id = public.mi_trabajador_id()
    and public.puede_ver_obra(obra_id)
  );

-- A propósito, NO se crea una política "for delete" para el trabajador: sin
-- ella, Postgres deniega el borrado por defecto para ese rol.
