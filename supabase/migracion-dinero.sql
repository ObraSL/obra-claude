-- Dinero: un solo sitio para los gastos + lo cobrado al cliente + lo que el
-- jefe le da al dueño. Pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo. Lo mismo está en schema.sql.

-- ---------------------------------------------------------------
-- 1) GASTOS Y FACTURAS, JUNTOS
--
-- Antes había dos listas y las facturas no contaban en lo gastado de la
-- obra. Ahora todo es "gasto" (ticket o factura), con su foto o PDF y quién
-- lo pagó. La tabla vieja de facturas NO se borra: se queda como copia.
-- ---------------------------------------------------------------

alter table public.gastos add column if not exists proveedor text;
-- De qué factura vieja viene: así, si esto se ejecuta dos veces, no se
-- pasa ninguna factura por duplicado.
alter table public.gastos add column if not exists factura_origen_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_factura_origen_unica') then
    alter table public.gastos add constraint gastos_factura_origen_unica unique (factura_origen_id);
  end if;
end $$;

-- Los archivos están en el mismo sitio y con el mismo formato que los
-- recibos de los gastos: se aprovecha la misma ruta, no se copia nada.
insert into public.gastos
  (obra_id, importe, concepto, categoria, fecha, recibo_path, recibo_tipo,
   pagado_por, proveedor, factura_origen_id, created_at)
select f.obra_id,
       f.importe,
       coalesce(nullif(trim(f.proveedor), ''), 'Factura'),
       'Otros',
       f.fecha,
       f.storage_path,
       f.tipo_archivo,
       f.pagado_por,
       nullif(trim(f.proveedor), ''),
       f.id,
       f.created_at
  from public.facturas f
 where not exists (select 1 from public.gastos g where g.factura_origen_id = f.id);

-- ---------------------------------------------------------------
-- 2) LO QUE PAGA EL CLIENTE POR LA OBRA
-- ---------------------------------------------------------------

create table if not exists public.cobros (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  importe numeric(12, 2) not null,
  fecha date not null,
  concepto text,
  archivo_path text,
  archivo_tipo text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 3) LO QUE EL JEFE LE DA AL DUEÑO (para gastos, sueldos…)
--
-- Es dinero en general, no de una obra: se le da a la persona. La obra se
-- puede apuntar si ayuda a acordarse, pero no hace falta.
-- Con esto sale "mi caja": lo que me dio el jefe − lo que pagué yo.
-- ---------------------------------------------------------------

create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  importe numeric(12, 2) not null,
  fecha date not null,
  concepto text,
  obra_id uuid references public.obras (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cobros_importe_positivo') then
    alter table public.cobros add constraint cobros_importe_positivo check (importe > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entregas_importe_positivo') then
    alter table public.entregas add constraint entregas_importe_positivo check (importe > 0);
  end if;
end $$;

alter table public.cobros enable row level security;
alter table public.entregas enable row level security;

-- Lo cobrado es el margen de la obra: lo ven el dueño y el manager, no el
-- jefe de obra (que ve los gastos para trabajar, pero no lo que se cobra).
drop policy if exists "cobros access" on public.cobros;
create policy "cobros access" on public.cobros
  for all using (public.mi_rol() in ('dueno', 'manager') and public.puede_gestionar_obra(obra_id))
  with check (public.mi_rol() in ('dueno', 'manager') and public.puede_gestionar_obra(obra_id));

-- Lo que el jefe le da al dueño es cosa suya: nadie más lo ve.
drop policy if exists "entregas dueno" on public.entregas;
create policy "entregas dueno" on public.entregas
  for all using (public.mi_rol() = 'dueno')
  with check (public.mi_rol() = 'dueno' and owner_id = public.owner_empresa());
