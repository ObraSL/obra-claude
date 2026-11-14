-- Gastos editables + proveedores favoritos + "lo pagué yo" solo del dueño +
-- vehículos por días y obras (sin km).
-- Pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo. Lo mismo está en schema.sql.

-- ---------------------------------------------------------------
-- 1) El "concepto" deja de ser obligatorio: ahora es una nota.
--    Lo que dice qué es el gasto ya lo dicen el proveedor y la categoría.
-- ---------------------------------------------------------------
alter table public.gastos alter column concepto drop not null;

-- ---------------------------------------------------------------
-- 2) PROVEEDORES, con favoritos arriba del todo
--    Una lista por empresa. En los gastos se sigue guardando el nombre
--    tal cual: esta tabla solo sirve para elegir rápido.
-- ---------------------------------------------------------------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.owner_empresa() references auth.users (id) on delete cascade,
  nombre text not null,
  favorito boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists proveedores_owner_nombre_idx
  on public.proveedores (owner_id, lower(nombre));

alter table public.proveedores enable row level security;

drop policy if exists "proveedores gestores" on public.proveedores;
create policy "proveedores gestores" on public.proveedores
  for all using (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and owner_id = public.owner_empresa())
  with check (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and owner_id = public.owner_empresa());

-- Los tres de siempre, ya como favoritos
insert into public.proveedores (owner_id, nombre, favorito)
select public.owner_empresa(), n, true
  from unnest(array['Leroy Merlin', 'Obramat', 'BigMat']) as n
 where public.owner_empresa() is not null
   and not exists (
     select 1 from public.proveedores p
      where p.owner_id = public.owner_empresa() and lower(p.nombre) = lower(n)
   );

-- Y los que ya se habían escrito a mano en algún gasto
insert into public.proveedores (owner_id, nombre)
select distinct on (o.owner_id, lower(trim(g.proveedor))) o.owner_id, trim(g.proveedor)
  from public.gastos g
  join public.obras o on o.id = g.obra_id
 where g.proveedor is not null and trim(g.proveedor) <> ''
   and not exists (
     select 1 from public.proveedores p
      where p.owner_id = o.owner_id and lower(p.nombre) = lower(trim(g.proveedor))
   );

-- ---------------------------------------------------------------
-- 3) "LO PAGUÉ YO" ES COSA DEL DUEÑO
--    Esos gastos cuentan en su caja (lo que le dio el jefe − lo que pagó
--    él). Si otro pudiera marcarlos o tocarlos, la caja dejaría de cuadrar.
--    Lo demás (lo que paga la empresa) lo siguen apuntando los gestores.
-- ---------------------------------------------------------------
create or replace function public.proteger_pagado_por_mi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin usuario = el propio dueño desde el editor SQL
  if auth.uid() is null or public.mi_rol() = 'dueno' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.pagado_por = 'personal' then
      raise exception 'Solo el dueño puede apuntar gastos pagados por él.';
    end if;
    return new;
  end if;

  if old.pagado_por = 'personal' then
    raise exception 'Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.';
  end if;
  if tg_op = 'UPDATE' and new.pagado_por = 'personal' then
    raise exception 'Solo el dueño puede marcar un gasto como pagado por él.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists proteger_pagado_por_mi on public.gastos;
create trigger proteger_pagado_por_mi
  before insert or update or delete on public.gastos
  for each row execute function public.proteger_pagado_por_mi();

-- ---------------------------------------------------------------
-- 4) VEHÍCULOS: qué día y a qué obra, sin km
--    Antes un coche solo podía tener un apunte al día. Pero el coche del
--    dueño puede ir a varias obras el mismo día: ahora es uno por obra y día.
--    Los km que ya había se quedan guardados, simplemente no se enseñan.
-- ---------------------------------------------------------------
do $$
declare
  c text;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.usos_vehiculo'::regclass
       and con.contype = 'u'
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(con.conkey) k
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k) = array['fecha', 'vehiculo_id']
  loop
    execute format('alter table public.usos_vehiculo drop constraint %I', c);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'usos_vehiculo_vehiculo_fecha_obra_key') then
    alter table public.usos_vehiculo
      add constraint usos_vehiculo_vehiculo_fecha_obra_key unique (vehiculo_id, fecha, obra_id);
  end if;
end $$;
