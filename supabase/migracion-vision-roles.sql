-- Punto 16 del plan: el trabajador pasa a ver el % de avance de la obra y
-- los vehículos (sin dinero); y el dueño puede darle a un jefe_obra permiso
-- para ver TODAS las obras de la empresa, no solo la suya.
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

-- ---------------------------------------------------------------
-- 1) Ajuste de empresa: ¿los jefe_obra ven todas las obras, o solo la suya?
-- ---------------------------------------------------------------

alter table public.ajustes add column if not exists jefe_ve_todas boolean not null default false;

-- ---------------------------------------------------------------
-- 2) puede_ver_obra / puede_gestionar_obra: el jefe_obra también pasa si
-- la empresa tiene activado "ve todas las obras".
-- ---------------------------------------------------------------

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
    when 'jefe_obra' then
      o_id = public.mi_obra_id()
      or coalesce((select jefe_ve_todas from public.ajustes where empresa_id = public.mi_empresa_id()), false)
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
    when 'jefe_obra' then
      o_id = public.mi_obra_id()
      or coalesce((select jefe_ve_todas from public.ajustes where empresa_id = public.mi_empresa_id()), false)
    else false
  end;
$$;

-- ---------------------------------------------------------------
-- 3) % de avance sin exponer los presupuestos de las tareas: una función
-- aparte que solo devuelve el número, no las filas de "tareas".
-- ---------------------------------------------------------------

create or replace function public.avance_obra(o_id uuid)
returns numeric
language plpgsql security definer stable
set search_path = public
as $$
declare
  resultado numeric;
begin
  if not public.puede_ver_obra(o_id) then
    return null;
  end if;

  select coalesce(
    sum((fecha_fin - fecha_inicio + 1) * avance) / nullif(sum(fecha_fin - fecha_inicio + 1), 0),
    0
  )
  into resultado
  from public.tareas
  where obra_id = o_id;

  return resultado;
end;
$$;

-- ---------------------------------------------------------------
-- 4) Vehículos: el trabajador pasa a poder VERLOS (no crearlos ni editar
-- los apuntes de uso — eso sigue siendo cosa de dueño/manager/jefe_obra).
-- ---------------------------------------------------------------

drop policy if exists "vehiculos select" on public.vehiculos;
create policy "vehiculos select" on public.vehiculos
  for select using (
    public.mi_rol() in ('dueno', 'manager', 'jefe_obra', 'trabajador')
    and empresa_id = public.mi_empresa_id()
  );

drop policy if exists "usos_vehiculo trabajador select" on public.usos_vehiculo;
create policy "usos_vehiculo trabajador select" on public.usos_vehiculo
  for select using (
    public.mi_rol() = 'trabajador' and public.puede_ver_obra(obra_id)
  );

-- Para poder enseñar "quién lo llevó": el trabajador ve los nombres de sus
-- compañeros (nada de dinero ni datos sensibles, solo el nombre).
drop policy if exists "trabajadores select" on public.trabajadores;
create policy "trabajadores select" on public.trabajadores
  for select using (public.mi_rol() is not null and empresa_id = public.mi_empresa_id());
