-- Planificación de la obra (diagrama de Gantt)
-- Pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo: no toca nada de lo que ya hay.
--
-- Esto mismo está también dentro de schema.sql, que sigue siendo la fuente
-- de la verdad; este archivo es solo el trozo nuevo, para no tener que
-- volver a pasar el esquema entero.

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  avance integer not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_avance_check') then
    alter table public.tareas add constraint tareas_avance_check
      check (avance >= 0 and avance <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_fechas_check') then
    alter table public.tareas add constraint tareas_fechas_check
      check (fecha_fin >= fecha_inicio);
  end if;
end $$;

-- Lo presupuestado para esa parte de la obra (sale del Excel, columna
-- AMOUNT sumada por capítulo). Sirve para comparar con lo gastado.
alter table public.tareas add column if not exists presupuesto numeric(12, 2);

create index if not exists tareas_obra_orden_idx on public.tareas (obra_id, orden, fecha_inicio);

-- La ve y la toca quien gestiona la obra (dueño, manager y el jefe de su
-- obra), igual que los gastos. El trabajador no entra aquí.
alter table public.tareas enable row level security;

drop policy if exists "tareas access" on public.tareas;
create policy "tareas access" on public.tareas
  for all using (public.has_obra_access(obra_id))
  with check (public.has_obra_access(obra_id));
