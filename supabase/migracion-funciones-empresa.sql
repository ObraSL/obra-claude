-- Fase 2, punto 14: las funciones de acceso pasan a mirar empresa_id en vez
-- de "el primer dueño de toda la base". Requiere haber pegado antes
-- migracion-empresas.sql (punto 13).
--
-- De paso, esto CIERRA varios huecos de aislamiento encontrados al revisar
-- las políticas para este cambio: varias comprobaban solo el ROL (dueño,
-- manager…) sin comprobar que la fila fuera de tu propia empresa. Con una
-- sola empresa esto nunca se notó; con una segunda empresa, su dueño podría
-- haber visto o tocado datos de la primera. Se arregla aquí, todo junto:
--   - "miembros dueno" — el más importante: sin esto, cualquier dueño podía
--     ver/aprobar/borrar miembros de OTRA empresa.
--   - "trabajadores select/write", "vehiculos select/write", "obras write",
--     "proveedores gestores", "entregas dueno", "ajustes leer/dueno".
-- El resto de tablas (gastos, cobros, tareas, notas, fichajes…) ya pasaban
-- por puede_ver_obra()/puede_gestionar_obra(), así que quedan arregladas
-- solas al arreglar esas dos funciones.
--
-- Efecto secundario bueno: antes, un "manager" que creara una obra o un
-- proveedor probablemente chocaba con el permiso (el default de owner_id
-- exigía coincidir con el dueño exacto). Ahora se compara la empresa, no la
-- persona exacta, así que un manager sí puede crear cosas de su empresa.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run, DESPUÉS de
-- migracion-empresas.sql. Es seguro volver a ejecutarlo. Lo mismo está en
-- schema.sql.

-- ---------------------------------------------------------------
-- 1) Funciones base nuevas
-- ---------------------------------------------------------------

create or replace function public.mi_empresa_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select empresa_id from public.miembros where user_id = auth.uid() and aprobado;
$$;

-- A qué empresa se apunta alguien nuevo que se registra, mientras no exista
-- todavía un flujo de "invitar a mi empresa" (eso es la Fase 3). Hoy solo
-- hay una empresa, así que un registro nuevo entra ahí — igual que ahora.
create or replace function public.empresa_por_defecto()
returns uuid language sql stable
set search_path = public
as $$
  select id from public.empresas order by created_at limit 1;
$$;

-- ---------------------------------------------------------------
-- 2) Helpers existentes, reescritos para mirar empresa_id
-- ---------------------------------------------------------------

create or replace function public.owner_empresa()
returns uuid language sql security definer stable
set search_path = public
as $$
  select user_id from public.miembros
  where rol = 'dueno' and aprobado and empresa_id = public.mi_empresa_id()
  order by created_at
  limit 1;
$$;

create or replace function public.puede_ver_obra(o_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.obras o
    where o.id = o_id and o.empresa_id = public.mi_empresa_id()
  )
  and case public.mi_rol()
    when 'dueno' then true
    when 'manager' then true
    when 'trabajador' then true
    when 'jefe_obra' then o_id = public.mi_obra_id()
    else false
  end;
$$;

create or replace function public.puede_gestionar_obra(o_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.obras o
    where o.id = o_id and o.empresa_id = public.mi_empresa_id()
  )
  and case public.mi_rol()
    when 'dueno' then true
    when 'manager' then true
    when 'jefe_obra' then o_id = public.mi_obra_id()
    else false
  end;
$$;

-- ---------------------------------------------------------------
-- 3) Ahora que las funciones existen: empresa_id se rellena solo al crear
-- filas nuevas, sin que la app tenga que enterarse de esto todavía.
-- ---------------------------------------------------------------

alter table public.obras alter column empresa_id set default public.mi_empresa_id();
alter table public.trabajadores alter column empresa_id set default public.mi_empresa_id();
alter table public.vehiculos alter column empresa_id set default public.mi_empresa_id();
alter table public.proveedores alter column empresa_id set default public.mi_empresa_id();
alter table public.entregas alter column empresa_id set default public.mi_empresa_id();
alter table public.ajustes alter column empresa_id set default public.mi_empresa_id();
alter table public.miembros alter column empresa_id set default public.empresa_por_defecto();

-- ---------------------------------------------------------------
-- 4) Políticas que comprobaban solo el rol, sin comprobar la empresa
-- ---------------------------------------------------------------

drop policy if exists "miembros dueno" on public.miembros;
create policy "miembros dueno" on public.miembros
  for all using (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id());

drop policy if exists "obras write" on public.obras;
create policy "obras write" on public.obras
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

drop policy if exists "trabajadores select" on public.trabajadores;
create policy "trabajadores select" on public.trabajadores
  for select using (
    (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id())
    or (public.mi_rol() = 'trabajador' and id = public.mi_trabajador_id())
  );

drop policy if exists "trabajadores write" on public.trabajadores;
create policy "trabajadores write" on public.trabajadores
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

drop policy if exists "vehiculos select" on public.vehiculos;
create policy "vehiculos select" on public.vehiculos
  for select using (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id());

drop policy if exists "vehiculos write" on public.vehiculos;
create policy "vehiculos write" on public.vehiculos
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

drop policy if exists "proveedores gestores" on public.proveedores;
create policy "proveedores gestores" on public.proveedores
  for all using (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id());

drop policy if exists "entregas dueno" on public.entregas;
create policy "entregas dueno" on public.entregas
  for all using (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id());

drop policy if exists "ajustes leer" on public.ajustes;
create policy "ajustes leer" on public.ajustes
  for select using (public.mi_rol() is not null and empresa_id = public.mi_empresa_id());

drop policy if exists "ajustes dueno" on public.ajustes;
create policy "ajustes dueno" on public.ajustes
  for all using (public.mi_rol() = 'dueno' and owner_id = auth.uid())
  with check (public.mi_rol() = 'dueno' and owner_id = auth.uid());

-- ---------------------------------------------------------------
-- 5) eliminar_obra: la comprobación de "es de esta empresa" pasa a mirar
-- empresa_id directamente, en vez de owner_id = owner_empresa().
-- ---------------------------------------------------------------

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

  if not exists (select 1 from public.obras where id = p_obra_id and empresa_id = public.mi_empresa_id()) then
    raise exception 'Esa obra no existe o no es de esta empresa.';
  end if;

  update public.fichajes_historial set obra_id_antes = null where obra_id_antes = p_obra_id;
  update public.fichajes_historial set obra_id_despues = null where obra_id_despues = p_obra_id;

  delete from public.fichajes_historial
   where fichaje_id in (select id from public.fichajes where obra_id = p_obra_id);

  delete from public.fichajes where obra_id = p_obra_id;
  delete from public.usos_vehiculo where obra_id = p_obra_id;
  delete from public.gastos where obra_id = p_obra_id;
  delete from public.facturas where obra_id = p_obra_id;
  delete from public.cobros where obra_id = p_obra_id;
  delete from public.notas_audio where obra_id = p_obra_id;
  delete from public.tareas where obra_id = p_obra_id;

  delete from public.obras where id = p_obra_id;
end;
$$;
