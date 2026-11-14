-- Control de Obra — esquema completo
-- Pega este archivo entero en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo (usa "if not exists" / "or replace").

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  direccion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fichajes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  trabajador_id uuid not null references public.trabajadores (id) on delete cascade,
  fecha date not null,
  hora_entrada text,
  hora_salida text,
  ubicacion text,
  created_at timestamptz not null default now(),
  unique (obra_id, trabajador_id, fecha)
);

-- Cómo llegó a la obra ese día. "traido_por" es texto libre: así el
-- trabajador puede decir quién le trajo sin ver la lista de la plantilla.
alter table public.fichajes add column if not exists transporte text;
alter table public.fichajes drop column if exists traido_por;
alter table public.fichajes add column if not exists traido_por text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fichajes_transporte_check') then
    alter table public.fichajes add constraint fichajes_transporte_check
      check (transporte is null or transporte in ('propio', 'traido'));
  end if;
end $$;

-- La hora la puso el dueño a mano (alguien se olvidó de fichar y el dueño
-- confirma a qué hora llegó). Se enseña en la app para que, si luego hay
-- discusión, se sepa qué horas se ficharon en el momento y cuáles no.
alter table public.fichajes add column if not exists hora_corregida boolean not null default false;

create table if not exists public.usos_vehiculo (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos (id) on delete cascade,
  fecha date not null,
  km_inicio integer,
  km_fin integer,
  destino text,
  conductor_id uuid references public.trabajadores (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Un apunte por coche, día y OBRA (antes era por coche y día): el coche del
-- dueño puede ir a varias obras el mismo día. Ya no se apuntan km: no se
-- pueden leer de forma fiable. Las columnas km_* se quedan con lo que había.
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

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  importe numeric(12, 2) not null,
  concepto text not null,
  categoria text not null,
  fecha date not null,
  recibo_path text,
  recibo_tipo text,
  created_at timestamptz not null default now()
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  proveedor text,
  importe numeric(12, 2) not null,
  fecha date not null,
  tipo_archivo text,
  nombre_archivo text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Migración: si las tablas ya existían sin estas columnas (versiones
-- anteriores del esquema), esto las añade sin tocar los datos guardados.
alter table public.gastos add column if not exists recibo_path text;
alter table public.gastos add column if not exists recibo_tipo text;

-- Quién puso el dinero: la empresa, o el dueño de su bolsillo. Sirve para
-- saber al final de mes cuánto dinero propio se ha adelantado.
alter table public.gastos add column if not exists pagado_por text not null default 'empresa';
alter table public.facturas add column if not exists pagado_por text not null default 'empresa';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_pagado_por_check') then
    alter table public.gastos add constraint gastos_pagado_por_check
      check (pagado_por in ('empresa', 'personal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'facturas_pagado_por_check') then
    alter table public.facturas add constraint facturas_pagado_por_check
      check (pagado_por in ('empresa', 'personal'));
  end if;
end $$;

-- ---------------------------------------------------------------
-- GASTOS Y FACTURAS, JUNTOS (19/09/2026)
-- Antes eran dos listas y las facturas no contaban en lo gastado de la obra.
-- Ahora todo es "gasto" (ticket o factura). La tabla facturas se queda como
-- copia de lo que había: la app ya no la usa.
-- ---------------------------------------------------------------
alter table public.gastos add column if not exists proveedor text;
alter table public.gastos add column if not exists factura_origen_id uuid;
-- El concepto pasa a ser una nota opcional: lo que es el gasto ya lo dicen
-- el proveedor y la categoría (19/09/2026).
alter table public.gastos alter column concepto drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_factura_origen_unica') then
    alter table public.gastos add constraint gastos_factura_origen_unica unique (factura_origen_id);
  end if;
end $$;

insert into public.gastos
  (obra_id, importe, concepto, categoria, fecha, recibo_path, recibo_tipo,
   pagado_por, proveedor, factura_origen_id, created_at)
select f.obra_id, f.importe, coalesce(nullif(trim(f.proveedor), ''), 'Factura'), 'Otros',
       f.fecha, f.storage_path, f.tipo_archivo, f.pagado_por,
       nullif(trim(f.proveedor), ''), f.id, f.created_at
  from public.facturas f
 where not exists (select 1 from public.gastos g where g.factura_origen_id = f.id);

-- Lo que paga el cliente por la obra.
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

-- Lo que el jefe le da al dueño para gastos o sueldos. Dinero en general, no
-- de una obra (se puede apuntar cuál, pero no hace falta). De aquí sale
-- "mi caja": lo que me dio el jefe − lo que pagué yo.
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

-- Nota de voz del día: una por obra y día (se puede regrabar).
create table if not exists public.notas_audio (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  fecha date not null,
  audio_path text not null,
  duracion_seg integer,
  created_at timestamptz not null default now(),
  unique (obra_id, fecha)
);

-- Planificación de la obra (diagrama de Gantt). Cada fila es una tarea con
-- sus fechas y su porcentaje de avance. El avance total de la obra se calcula
-- a partir de aquí, pesando cada tarea por los días que dura: una tarea de
-- dos meses cuenta más que una de dos días.
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

-- Lo que hay presupuestado para esa parte de la obra. Sale del Excel del
-- cliente (la columna AMOUNT sumada por capítulo) y sirve para comparar
-- luego con lo realmente gastado.
alter table public.tareas add column if not exists presupuesto numeric(12, 2);

create index if not exists tareas_obra_orden_idx on public.tareas (obra_id, orden, fecha_inicio);

-- Prohíbe el borrado en cascada (27/09/2026): hasta ahora, borrar una obra,
-- un trabajador o un vehículo borraba automáticamente y sin aviso todos sus
-- fichajes, gastos, facturas, cobros, notas de audio, tareas y usos de
-- vehículo. Ahora Postgres se niega a borrar el "padre" mientras tenga datos
-- colgando. La app no cambia en nada: nunca borra obras/trabajadores/
-- vehículos de verdad, solo los desactiva (activa/activo). Esto solo cierra
-- la puerta a un borrado accidental desde el Table Editor o el SQL Editor.
-- Lo mismo está en migracion-proteger-borrado.sql.
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

-- Ajustes de la cuenta: de momento, cuántas horas dura la jornada normal.
-- Lo que pase de ahí en un día cuenta como horas extra.
create table if not exists public.ajustes (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  jornada_horas numeric(4, 2) not null default 8,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- QUIÉN ENTRA Y HASTA DÓNDE
--
-- Cada cuenta registrada tiene una fila aquí. Cuatro niveles:
--   dueno      → todo, y es quien reparte los accesos
--   manager    → todas las obras
--   jefe_obra  → solo la obra que tenga asignada en obra_id
--   trabajador → solo ficha SUS horas; no ve gastos, facturas,
--                vehículos, notas ni a los demás trabajadores
-- Nadie entra sin que el dueño le ponga aprobado = true.
-- ---------------------------------------------------------------

create table if not exists public.miembros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text,
  rol text not null default 'trabajador',
  obra_id uuid references public.obras (id) on delete set null,
  trabajador_id uuid references public.trabajadores (id) on delete set null,
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'miembros_rol_check') then
    alter table public.miembros add constraint miembros_rol_check
      check (rol in ('dueno', 'manager', 'jefe_obra', 'trabajador'));
  end if;
end $$;

-- La tabla vieja de invitaciones queda sustituida por "miembros".
drop table if exists public.colaboradores;

-- Quien se registre con un código de invitación (?empresa=XXXXXXXX) entra
-- como trabajador SIN aprobar en ESA empresa: hasta que el dueño no le dé
-- acceso no ve absolutamente nada. Quien se registre SIN código crea su
-- propia empresa nueva y es su dueño desde el primer momento (adelanto del
-- punto 19, 29/09/2026: antes, cualquier registro se unía siempre a la
-- primera empresa que existiera).
create or replace function public.crear_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_nombre_empresa text;
  v_empresa_id uuid;
begin
  v_codigo := new.raw_user_meta_data ->> 'empresa_codigo';

  if v_codigo is not null then
    select id into v_empresa_id from public.empresas where codigo = v_codigo;
  end if;

  if v_empresa_id is not null then
    insert into public.miembros (user_id, email, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), 'trabajador', false, v_empresa_id)
    on conflict (user_id) do nothing;
  else
    v_nombre_empresa := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_empresa'), ''), 'Mi empresa');
    insert into public.empresas (nombre) values (v_nombre_empresa) returning id into v_empresa_id;
    insert into public.miembros (user_id, email, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), 'dueno', true, v_empresa_id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_miembro();

-- El recién registrado escribe su nombre para que el dueño sepa quién es.
-- Solo puede tocar su nombre: ni su rol ni su aprobación.
create or replace function public.guardar_mi_nombre(nuevo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.miembros (user_id, email, nombre, rol, aprobado)
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), ''),
    nuevo,
    'trabajador',
    false
  )
  on conflict (user_id) do update set nombre = excluded.nombre;
end;
$$;

-- ---------------------------------------------------------------
-- HELPERS DE PERMISOS
-- Son "security definer" a propósito: consultan miembros/obras sin que
-- el usuario necesite permiso de lectura sobre ellas.
-- ---------------------------------------------------------------

create or replace function public.owner_empresa()
returns uuid language sql security definer stable
set search_path = public
as $$
  select user_id from public.miembros
  where rol = 'dueno' and aprobado
  order by created_at
  limit 1;
$$;

/**
 * Rol del que está conectado. null si no existe, no está aprobado, o si es
 * una fila de soporte (punto 17) cuyo acceso ya caducó o fue revocado.
 */
create or replace function public.mi_rol()
returns text language sql security definer stable
set search_path = public
as $$
  select m.rol from public.miembros m
  where m.user_id = auth.uid() and m.aprobado
    and (
      not m.es_soporte
      or exists (
        select 1 from public.soporte_accesos sa
        where sa.empresa_id = m.empresa_id and sa.otorgado_a = m.user_id
          and sa.revocado_en is null and sa.expira_en > now()
      )
    );
$$;

create or replace function public.mi_trabajador_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select trabajador_id from public.miembros where user_id = auth.uid() and aprobado;
$$;

create or replace function public.mi_obra_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select obra_id from public.miembros where user_id = auth.uid() and aprobado;
$$;

/** Ver la obra (incluye al trabajador: necesita saber dónde ficha). */
create or replace function public.puede_ver_obra(o_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.obras o
    where o.id = o_id and o.owner_id = public.owner_empresa()
  )
  and case public.mi_rol()
    when 'dueno' then true
    when 'manager' then true
    when 'trabajador' then true
    when 'jefe_obra' then o_id = public.mi_obra_id()
    else false
  end;
$$;

/** Gestionar la obra: gastos, facturas, vehículos, notas, fichar a otros. */
create or replace function public.puede_gestionar_obra(o_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.obras o
    where o.id = o_id and o.owner_id = public.owner_empresa()
  )
  and case public.mi_rol()
    when 'dueno' then true
    when 'manager' then true
    when 'jefe_obra' then o_id = public.mi_obra_id()
    else false
  end;
$$;

-- Se mantiene el nombre antiguo porque lo usan varias políticas ya creadas.
create or replace function public.has_obra_access(o_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select public.puede_gestionar_obra(o_id);
$$;

-- ---------------------------------------------------------------
-- PROVEEDORES, con favoritos arriba del todo (va aquí, después de los
-- helpers, porque el owner_id por defecto usa owner_empresa()).
-- Una lista por empresa. En los gastos se guarda el nombre tal cual: esta
-- tabla solo sirve para elegir rápido.
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

insert into public.proveedores (owner_id, nombre, favorito)
select public.owner_empresa(), n, true
  from unnest(array['Leroy Merlin', 'Obramat', 'BigMat']) as n
 where public.owner_empresa() is not null
   and not exists (
     select 1 from public.proveedores p
      where p.owner_id = public.owner_empresa() and lower(p.nombre) = lower(n)
   );

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
-- FASE 2, PUNTO 13 (29/09/2026): tabla "empresas" y empresa_id en las 7
-- tablas que hacen falta para separar los datos de cada cliente futuro.
-- Ahora mismo solo hay una empresa (la tuya): se crea esa fila y todo lo que
-- ya existe se le asigna. Lo mismo está en migracion-empresas.sql.
-- ---------------------------------------------------------------

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Adelanto del punto 19 (29/09/2026): código corto para invitar. Con
-- ?empresa=<codigo> en el enlace de registro, quien se registra se une a
-- ESTA empresa; sin código, crea la suya propia (ver crear_miembro() más
-- abajo).
alter table public.empresas add column if not exists codigo text;
update public.empresas
set codigo = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where codigo is null;
alter table public.empresas alter column codigo set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
alter table public.empresas alter column codigo set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_codigo_key') then
    alter table public.empresas add constraint empresas_codigo_key unique (codigo);
  end if;
end $$;

create or replace function public.nombre_empresa_por_codigo(p_codigo text)
returns text
language sql security definer stable
set search_path = public
as $$
  select nombre from public.empresas where codigo = p_codigo;
$$;

do $$
declare
  v_empresa_id uuid;
begin
  select id into v_empresa_id from public.empresas order by created_at limit 1;

  if v_empresa_id is null then
    insert into public.empresas (nombre) values ('Mi empresa') returning id into v_empresa_id;
  end if;

  alter table public.obras add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.trabajadores add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.vehiculos add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.proveedores add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.entregas add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.ajustes add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.miembros add column if not exists empresa_id uuid references public.empresas (id);

  update public.obras set empresa_id = v_empresa_id where empresa_id is null;
  update public.trabajadores set empresa_id = v_empresa_id where empresa_id is null;
  update public.vehiculos set empresa_id = v_empresa_id where empresa_id is null;
  update public.proveedores set empresa_id = v_empresa_id where empresa_id is null;
  update public.entregas set empresa_id = v_empresa_id where empresa_id is null;
  update public.ajustes set empresa_id = v_empresa_id where empresa_id is null;
  update public.miembros set empresa_id = v_empresa_id where empresa_id is null;
end $$;

alter table public.obras alter column empresa_id set not null;
alter table public.trabajadores alter column empresa_id set not null;
alter table public.vehiculos alter column empresa_id set not null;
alter table public.proveedores alter column empresa_id set not null;
alter table public.entregas alter column empresa_id set not null;
alter table public.ajustes alter column empresa_id set not null;
alter table public.miembros alter column empresa_id set not null;

create index if not exists obras_empresa_idx on public.obras (empresa_id);
create index if not exists trabajadores_empresa_idx on public.trabajadores (empresa_id);
create index if not exists vehiculos_empresa_idx on public.vehiculos (empresa_id);
create index if not exists proveedores_empresa_idx on public.proveedores (empresa_id);
create index if not exists entregas_empresa_idx on public.entregas (empresa_id);
create index if not exists miembros_empresa_idx on public.miembros (empresa_id);

alter table public.empresas enable row level security;
drop policy if exists "empresas propia" on public.empresas;
create policy "empresas propia" on public.empresas
  for select using (
    id in (select empresa_id from public.miembros where user_id = auth.uid() and aprobado)
  );

-- ---------------------------------------------------------------
-- FASE 2, PUNTO 14 (29/09/2026): las funciones de acceso pasan a mirar
-- empresa_id en vez de "el primer dueño de toda la base". De paso, cierra
-- varios huecos de aislamiento que solo comprobaban el ROL sin comprobar la
-- empresa (con una sola empresa nunca se notó): "miembros dueno" (el más
-- importante — sin esto cualquier dueño podía ver/aprobar/borrar miembros de
-- OTRA empresa), "trabajadores select/write", "vehiculos select/write",
-- "obras write", "proveedores gestores", "entregas dueno", "ajustes
-- leer/dueno". El resto (gastos, cobros, tareas, notas, fichajes…) ya pasaba
-- por puede_ver_obra()/puede_gestionar_obra(), así que queda arreglado solo.
-- Efecto secundario bueno: antes, un "manager" que creara una obra o un
-- proveedor probablemente chocaba con el permiso (el owner_id exigía
-- coincidir con el dueño exacto); ahora se compara la empresa, así que un
-- manager sí puede crear cosas de su empresa.
-- Lo mismo está en migracion-funciones-empresa.sql.
-- ---------------------------------------------------------------

create or replace function public.mi_empresa_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select m.empresa_id from public.miembros m
  where m.user_id = auth.uid() and m.aprobado
    and (
      not m.es_soporte
      or exists (
        select 1 from public.soporte_accesos sa
        where sa.empresa_id = m.empresa_id and sa.otorgado_a = m.user_id
          and sa.revocado_en is null and sa.expira_en > now()
      )
    );
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

-- Punto 16 (29/09/2026): el % de avance de la obra, sin exponer las filas
-- de "tareas" (que llevan el presupuesto de cada capítulo). El trabajador
-- puede llamar a esta función aunque no pueda leer la tabla tareas.
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

alter table public.ajustes add column if not exists jefe_ve_todas boolean not null default false;

alter table public.obras alter column empresa_id set default public.mi_empresa_id();
alter table public.trabajadores alter column empresa_id set default public.mi_empresa_id();
alter table public.vehiculos alter column empresa_id set default public.mi_empresa_id();
alter table public.proveedores alter column empresa_id set default public.mi_empresa_id();
alter table public.entregas alter column empresa_id set default public.mi_empresa_id();
alter table public.ajustes alter column empresa_id set default public.mi_empresa_id();
alter table public.miembros alter column empresa_id set default public.empresa_por_defecto();

-- Las políticas que hacía falta corregir ("miembros dueno", "obras write",
-- "trabajadores select/write", "vehiculos select/write", "proveedores
-- gestores", "entregas dueno", "ajustes leer/dueno") se editan más abajo,
-- donde ya estaban definidas — así no queda una copia adelantada que luego
-- la sección de RLS original pisaría sin querer. eliminar_obra() también se
-- corrige donde ya estaba.

-- Complemento al punto 5 (27/09/2026): hasta ahora, borrar la CUENTA del
-- dueño (por ejemplo desde Supabase → Authentication → Users) borraba en
-- cascada TODA la empresa: obras, trabajadores, vehículos, proveedores,
-- entregas y ajustes. Estas seis tablas colgaban directamente de la cuenta.
-- Lo mismo está en migracion-proteger-cuenta-dueno.sql.
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

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------

alter table public.obras enable row level security;
alter table public.trabajadores enable row level security;
alter table public.vehiculos enable row level security;
alter table public.fichajes enable row level security;
alter table public.usos_vehiculo enable row level security;
alter table public.gastos enable row level security;
alter table public.facturas enable row level security;
alter table public.ajustes enable row level security;
alter table public.notas_audio enable row level security;
alter table public.miembros enable row level security;
alter table public.tareas enable row level security;
alter table public.cobros enable row level security;
alter table public.entregas enable row level security;
alter table public.proveedores enable row level security;

-- miembros: el dueño manda. Cada uno ve SOLO su propia fila y no puede
-- modificarla (si pudiera, se ascendería a sí mismo); para el nombre está
-- la función guardar_mi_nombre.
-- Fase 2 (29/09/2026): antes era solo "mi_rol()='dueno'", sin comprobar la
-- empresa — cualquier dueño podía ver/aprobar/borrar miembros de OTRA
-- empresa. Con una sola empresa nunca se notó.
drop policy if exists "miembros dueno" on public.miembros;
create policy "miembros dueno" on public.miembros
  for all using (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id());

drop policy if exists "miembros propio" on public.miembros;
create policy "miembros propio" on public.miembros
  for select using (user_id = auth.uid());

-- obras
drop policy if exists "obras select" on public.obras;
create policy "obras select" on public.obras
  for select using (public.puede_ver_obra(id));

drop policy if exists "obras write" on public.obras;
create policy "obras write" on public.obras
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

-- trabajadores: punto 16 (29/09/2026) — cualquier aprobado ve los nombres
-- de sus compañeros de empresa (hace falta para "quién llevó el coche");
-- nada de dinero ni datos sensibles, solo el nombre.
drop policy if exists "trabajadores select" on public.trabajadores;
create policy "trabajadores select" on public.trabajadores
  for select using (public.mi_rol() is not null and empresa_id = public.mi_empresa_id());

drop policy if exists "trabajadores write" on public.trabajadores;
create policy "trabajadores write" on public.trabajadores
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

-- vehiculos: punto 16 (29/09/2026) — el trabajador pasa a poder VERLOS
-- (no crearlos ni editar los apuntes de uso, eso sigue en "vehiculos write"
-- y en las políticas de usos_vehiculo, que no incluyen a trabajador).
drop policy if exists "vehiculos select" on public.vehiculos;
create policy "vehiculos select" on public.vehiculos
  for select using (
    public.mi_rol() in ('dueno', 'manager', 'jefe_obra', 'trabajador')
    and empresa_id = public.mi_empresa_id()
  );

drop policy if exists "vehiculos write" on public.vehiculos;
create policy "vehiculos write" on public.vehiculos
  for all using (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager') and empresa_id = public.mi_empresa_id());

-- fichajes: los gestores fichan a toda la cuadrilla; el trabajador SOLO
-- puede tocar sus propias filas
drop policy if exists "fichajes access" on public.fichajes;
drop policy if exists "fichajes gestores" on public.fichajes;
create policy "fichajes gestores" on public.fichajes
  for all using (public.puede_gestionar_obra(obra_id))
  with check (public.puede_gestionar_obra(obra_id));

-- Punto 11 (29/09/2026): antes esto era una sola política "for all", que en
-- Postgres incluye DELETE — el trabajador podía borrar su propio fichaje
-- (por ejemplo, para esconder un retraso). Se separa en select/insert/update
-- a propósito, sin política de delete: sin ella, Postgres lo deniega por
-- defecto para ese rol. Lo mismo está en migracion-cerrar-borrado-trabajador.sql.
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

-- ---------------------------------------------------------------
-- HORAS DE FICHAJE: solo el dueño las pone a mano
--
-- Las políticas de arriba dicen QUIÉN puede tocar un fichaje, pero no QUÉ
-- hora puede escribir: un trabajador con algo de maña podría mandar
-- "entrada 06:00" saltándose la app. Este disparador lo impide en la propia
-- base de datos, que es donde no se puede hacer trampa:
--
--   dueño      → pone y corrige cualquier hora, de cualquier día
--   los demás  → la hora la pone el SERVIDOR (no el móvil, que se puede
--                adelantar), solo el día de hoy y una sola vez: una hora
--                ya fichada no se puede volver a fichar encima
--
-- Así nadie puede irse a las 14:00 y darle otra vez a "Salida" a las 20:00
-- desde casa.
-- ---------------------------------------------------------------

create or replace function public.proteger_horas_fichaje()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ahora text := to_char(now() at time zone 'Europe/Madrid', 'HH24:MI');
  hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Sin usuario = el propio dueño arreglando datos desde el editor SQL.
  -- (Una petición anónima de fuera tampoco pasaría: RLS no le deja escribir.)
  if auth.uid() is null then
    return new;
  end if;

  if public.mi_rol() = 'dueno' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.hora_corregida := false;
  else
    new.hora_corregida := old.hora_corregida;
    -- Mover un fichaje a otro día, obra o persona también sería cambiar horas
    if new.fecha is distinct from old.fecha
       or new.obra_id is distinct from old.obra_id
       or new.trabajador_id is distinct from old.trabajador_id then
      raise exception 'Solo el dueño puede cambiar un fichaje ya hecho.';
    end if;
  end if;

  if (tg_op = 'INSERT' and new.hora_entrada is not null)
     or (tg_op = 'UPDATE' and new.hora_entrada is distinct from old.hora_entrada) then
    if tg_op = 'UPDATE' and old.hora_entrada is not null then
      raise exception 'La entrada ya está fichada. Solo el dueño puede cambiarla.';
    end if;
    if new.fecha <> hoy then
      raise exception 'Solo se puede fichar el día de hoy.';
    end if;
    new.hora_entrada := ahora;
  end if;

  if (tg_op = 'INSERT' and new.hora_salida is not null)
     or (tg_op = 'UPDATE' and new.hora_salida is distinct from old.hora_salida) then
    if tg_op = 'UPDATE' and old.hora_salida is not null then
      raise exception 'La salida ya está fichada. Solo el dueño puede cambiarla.';
    end if;
    if new.fecha <> hoy then
      raise exception 'Solo se puede fichar el día de hoy.';
    end if;
    new.hora_salida := ahora;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_horas_fichaje on public.fichajes;
create trigger proteger_horas_fichaje
  before insert or update on public.fichajes
  for each row execute function public.proteger_horas_fichaje();

-- ---------------------------------------------------------------
-- JOURNAL DE CORRECCIONES + CONFIRMACIÓN DEL TRABAJADOR (27/09/2026)
--
-- Antes solo había una marca sí/no ("hora_corregida"): se sabía que el dueño
-- había tocado la hora, pero no quién, cuándo, ni cuál era el valor antes de
-- tocarla. Esto añade un historial que se rellena solo, y una marca de que
-- el trabajador vio la corrección y la confirmó (o todavía no).
-- Lo mismo está en migracion-historial-fichajes.sql.
-- ---------------------------------------------------------------

alter table public.fichajes
  add column if not exists confirmado_trabajador boolean not null default true;

create table if not exists public.fichajes_historial (
  id uuid primary key default gen_random_uuid(),
  fichaje_id uuid not null references public.fichajes (id) on delete restrict,
  obra_id uuid not null references public.obras (id) on delete restrict,
  trabajador_id uuid not null references public.trabajadores (id) on delete restrict,
  fecha date not null,
  hora_entrada_antes text,
  hora_salida_antes text,
  hora_entrada_despues text,
  hora_salida_despues text,
  cambiado_por uuid references auth.users (id) on delete set null,
  cambiado_en timestamptz not null default now()
);

-- Punto 4 (28/09/2026): mover un fichaje ya hecho a la obra correcta cuando
-- fue un error del día. Lo mismo está en migracion-mover-obra-fichaje.sql.
alter table public.fichajes_historial
  add column if not exists obra_id_antes uuid references public.obras (id),
  add column if not exists obra_id_despues uuid references public.obras (id);

create index if not exists fichajes_historial_fichaje_idx
  on public.fichajes_historial (fichaje_id, cambiado_en desc);

-- Se ejecuta DESPUÉS de "proteger_horas_fichaje" (orden alfabético de los
-- triggers "before"), así que ve ya aplicadas sus reglas. Solo toca la marca
-- de "sin confirmar": el historial se escribe aparte, en un trigger AFTER
-- (ver más abajo) — un upsert con "on conflict" dispara el BEFORE INSERT
-- igual aunque termine siendo un UPDATE, y ahí new.id es un id que nunca
-- llega a existir; insertar el historial desde ese punto rompía la clave
-- foránea. Un trigger AFTER solo ve lo que realmente pasó.
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

drop trigger if exists registrar_correccion_fichaje on public.fichajes;
create trigger registrar_correccion_fichaje
  before insert or update on public.fichajes
  for each row execute function public.registrar_correccion_fichaje();

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

-- ---------------------------------------------------------------
-- PUNTOS 9 Y 10 (28/09/2026): geolocalización al fichar (dentro/fuera del
-- radio de la obra, sin guardar coordenadas exactas cada vez — solo el
-- resultado y la distancia) + regla de tiempo mínimo antes del turno + aviso
-- al trabajador con confirmación de lectura. Lo mismo está en
-- migracion-geolocalizacion.sql.
-- ---------------------------------------------------------------

alter table public.obras
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists radio_metros integer not null default 150,
  add column if not exists hora_inicio_turno text,
  add column if not exists minutos_antes_permitidos integer not null default 30;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'obras_hora_inicio_turno_check') then
    alter table public.obras add constraint obras_hora_inicio_turno_check
      check (hora_inicio_turno is null or hora_inicio_turno ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;

alter table public.fichajes
  add column if not exists ubicacion_ok boolean,
  add column if not exists distancia_metros integer;

alter table public.miembros
  add column if not exists aviso_control_leido_en timestamptz,
  add column if not exists aviso_control_version text;

-- No se puede fichar la entrada de hoy antes de (hora_inicio_turno −
-- minutos_antes_permitidos). Solo si la obra tiene hora_inicio_turno puesta;
-- el dueño no tiene esta restricción.
create or replace function public.validar_hora_fichaje()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_hora_inicio text;
  v_minutos_antes integer;
  v_limite text;
begin
  if auth.uid() is null or public.mi_rol() = 'dueno' then
    return new;
  end if;

  if new.hora_entrada is not null and (tg_op = 'INSERT' or old.hora_entrada is distinct from new.hora_entrada) then
    select hora_inicio_turno, minutos_antes_permitidos into v_hora_inicio, v_minutos_antes
      from public.obras where id = new.obra_id;

    if v_hora_inicio is not null then
      v_limite := to_char(
        (current_date + v_hora_inicio::time) - (v_minutos_antes || ' minutes')::interval,
        'HH24:MI'
      );
      if new.hora_entrada < v_limite then
        raise exception 'Todavía no puedes fichar: el turno empieza a las %. Puedes entrar desde las %.',
          v_hora_inicio, v_limite;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_hora_fichaje on public.fichajes;
create trigger validar_hora_fichaje
  before insert or update on public.fichajes
  for each row execute function public.validar_hora_fichaje();

-- El trabajador solo puede tocar esto de su propia fila (igual que
-- guardar_mi_nombre): confirma que ha leído el aviso sobre horario y
-- geolocalización, con fecha y versión del texto.
create or replace function public.confirmar_aviso_control(version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.miembros
     set aviso_control_leido_en = now(),
         aviso_control_version = version
   where user_id = auth.uid();
end;
$$;

-- Quién ve el historial: los mismos que gestionan la obra, y el propio
-- trabajador solo el suyo. Nadie inserta filas a mano: eso solo lo hace el
-- trigger de arriba (es "security definer").
alter table public.fichajes_historial enable row level security;

drop policy if exists "fichajes_historial gestores" on public.fichajes_historial;
create policy "fichajes_historial gestores" on public.fichajes_historial
  for select using (public.puede_gestionar_obra(obra_id));

drop policy if exists "fichajes_historial propio" on public.fichajes_historial;
create policy "fichajes_historial propio" on public.fichajes_historial
  for select using (
    public.mi_rol() = 'trabajador'
    and trabajador_id = public.mi_trabajador_id()
    and public.puede_ver_obra(obra_id)
  );

-- ---------------------------------------------------------------
-- "LO PAGUÉ YO" ES COSA DEL DUEÑO (19/09/2026)
-- Esos gastos cuentan en su caja (lo que le dio el jefe − lo que pagó él).
-- Si otro pudiera marcarlos o tocarlos, la caja dejaría de cuadrar. Lo que
-- paga la empresa lo siguen apuntando los gestores.
-- ---------------------------------------------------------------
create or replace function public.proteger_pagado_por_mi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

-- dinero y logística: solo gestores
drop policy if exists "usos_vehiculo access" on public.usos_vehiculo;
create policy "usos_vehiculo access" on public.usos_vehiculo
  for all using (public.has_obra_access(obra_id)) with check (public.has_obra_access(obra_id));

-- punto 16 (29/09/2026): el trabajador solo puede VER quién llevó cada
-- coche y a dónde, no crear ni cambiar apuntes.
drop policy if exists "usos_vehiculo trabajador select" on public.usos_vehiculo;
create policy "usos_vehiculo trabajador select" on public.usos_vehiculo
  for select using (public.mi_rol() = 'trabajador' and public.puede_ver_obra(obra_id));

drop policy if exists "gastos access" on public.gastos;
create policy "gastos access" on public.gastos
  for all using (public.has_obra_access(obra_id)) with check (public.has_obra_access(obra_id));

drop policy if exists "facturas access" on public.facturas;
create policy "facturas access" on public.facturas
  for all using (public.has_obra_access(obra_id)) with check (public.has_obra_access(obra_id));

-- proveedores: la lista de la empresa, para quien apunta gastos
drop policy if exists "proveedores gestores" on public.proveedores;
create policy "proveedores gestores" on public.proveedores
  for all using (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() in ('dueno', 'manager', 'jefe_obra') and empresa_id = public.mi_empresa_id());

-- cobros: el margen de la obra lo ven el dueño y el manager, no el jefe de obra
drop policy if exists "cobros access" on public.cobros;
create policy "cobros access" on public.cobros
  for all using (public.mi_rol() in ('dueno', 'manager') and public.puede_gestionar_obra(obra_id))
  with check (public.mi_rol() in ('dueno', 'manager') and public.puede_gestionar_obra(obra_id));

-- entregas: lo que el jefe le da al dueño, solo lo ve el dueño
-- Fase 2 (29/09/2026): antes "using" solo comprobaba el rol, sin empresa —
-- cualquier dueño podía ver/tocar entregas de OTRA empresa.
drop policy if exists "entregas dueno" on public.entregas;
create policy "entregas dueno" on public.entregas
  for all using (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id())
  with check (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id());

-- planificación: la ve y la toca quien gestiona la obra, igual que el dinero.
-- El trabajador no entra aquí (solo ficha sus horas).
drop policy if exists "tareas access" on public.tareas;
create policy "tareas access" on public.tareas
  for all using (public.has_obra_access(obra_id))
  with check (public.has_obra_access(obra_id));

drop policy if exists "notas_audio access" on public.notas_audio;
create policy "notas_audio access" on public.notas_audio
  for all using (public.has_obra_access(obra_id))
  with check (public.has_obra_access(obra_id));

-- ajustes: todos los aprobados leen la jornada (hace falta para calcular
-- las horas extra); solo el dueño la cambia
-- Fase 2 (29/09/2026): "ajustes leer" dejaba ver la jornada de CUALQUIER
-- empresa a cualquier aprobado; "ajustes dueno" dejaba a cualquier dueño
-- borrar el ajuste de otra empresa (el "with check" ya protegía el update,
-- pero el "using" no protegía el delete).
-- Punto 15 (29/09/2026): el autotest de aislamiento encontro una tercera
-- politica, "ajustes lectura", que nadie habia tocado en el arreglo de
-- arriba: dejaba leer la jornada de CUALQUIER empresa a cualquier usuario
-- con un rol (el using tenia un OR en vez de un AND). Se borra sin más,
-- "ajustes leer" ya cubre el acceso correcto.
drop policy if exists "ajustes lectura" on public.ajustes;
drop policy if exists "ajustes owner" on public.ajustes;
drop policy if exists "ajustes leer" on public.ajustes;
create policy "ajustes leer" on public.ajustes
  for select using (public.mi_rol() is not null and empresa_id = public.mi_empresa_id());

drop policy if exists "ajustes dueno" on public.ajustes;
create policy "ajustes dueno" on public.ajustes
  for all using (public.mi_rol() = 'dueno' and owner_id = auth.uid())
  with check (public.mi_rol() = 'dueno' and owner_id = auth.uid());

-- ---------------------------------------------------------------
-- STORAGE: buckets privados (facturas, recibos de gastos y notas de voz)
-- Convención de rutas: {obra_id}/{archivo}, así la política solo
-- necesita comprobar el primer segmento de la ruta.
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('notas', 'notas', false)
on conflict (id) do nothing;

drop policy if exists "notas storage access" on storage.objects;
create policy "notas storage access" on storage.objects
  for all using (
    bucket_id = 'notas'
    and public.has_obra_access((storage.foldername(name)) [1]::uuid)
  )
  with check (
    bucket_id = 'notas'
    and public.has_obra_access((storage.foldername(name)) [1]::uuid)
  );

drop policy if exists "facturas storage access" on storage.objects;
create policy "facturas storage access" on storage.objects
  for all using (
    bucket_id = 'facturas'
    and public.has_obra_access((storage.foldername(name)) [1]::uuid)
  )
  with check (
    bucket_id = 'facturas'
    and public.has_obra_access((storage.foldername(name)) [1]::uuid)
  );

-- ---------------------------------------------------------------
-- BORRADO DEFINITIVO DE UNA OBRA (28/09/2026, a petición explícita del
-- dueño: con años, cientos de obras, hace falta poder quitar las muy
-- viejas). El punto 5 (ON DELETE RESTRICT) sigue protegiendo contra un
-- borrado accidental; esta función es la única puerta pensada para borrar
-- de verdad. Exige ser el dueño y es irreversible — la app pide antes
-- escribir el nombre de la obra y la contraseña de la cuenta.
-- No borra los archivos del Storage: eso lo hace la app antes de llamarla.
-- Lo mismo está en migracion-eliminar-obra.sql.
-- ---------------------------------------------------------------

create or replace function public.eliminar_obra(p_obra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mi_rol() is distinct from 'dueno' then
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

-- ---------------------------------------------------------------
-- PUNTO 17 (29/09/2026): acceso de soporte para el desarrollador. Cada
-- empresa da y quita su propio acceso, con caducidad automática y un
-- registro de quién lo dio/quitó y cuándo. mi_rol()/mi_empresa_id() (más
-- arriba) ya llevan la comprobación de caducidad — aquí solo la tabla y las
-- dos funciones para dar/quitar el acceso.
-- ---------------------------------------------------------------

alter table public.miembros add column if not exists es_soporte boolean not null default false;

create table if not exists public.soporte_accesos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  otorgado_a uuid not null references auth.users (id),
  email text not null,
  otorgado_por uuid not null references auth.users (id),
  otorgado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  revocado_en timestamptz,
  revocado_por uuid references auth.users (id)
);

alter table public.soporte_accesos enable row level security;

drop policy if exists "soporte_accesos dueno" on public.soporte_accesos;
create policy "soporte_accesos dueno" on public.soporte_accesos
  for select using (public.mi_rol() = 'dueno' and empresa_id = public.mi_empresa_id());

create or replace function public.dar_acceso_soporte(email_soporte text, horas integer default 24)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_empresa_id uuid;
begin
  if public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede dar acceso de soporte.';
  end if;
  if horas is null or horas <= 0 or horas > 24 * 30 then
    raise exception 'Las horas tienen que ser entre 1 y 720 (30 días).';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(email_soporte);
  if v_user_id is null then
    raise exception 'Esa cuenta todavía no existe: tiene que registrarse primero en la app.';
  end if;

  if exists (select 1 from public.miembros where user_id = v_user_id and not es_soporte) then
    raise exception 'Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.';
  end if;

  v_empresa_id := public.mi_empresa_id();

  insert into public.miembros (user_id, email, rol, aprobado, empresa_id, es_soporte)
  values (v_user_id, email_soporte, 'dueno', true, v_empresa_id, true)
  on conflict (user_id) do update
    set empresa_id = excluded.empresa_id, rol = 'dueno', aprobado = true, es_soporte = true;

  insert into public.soporte_accesos (empresa_id, otorgado_a, email, otorgado_por, expira_en)
  values (v_empresa_id, v_user_id, email_soporte, auth.uid(), now() + (horas || ' hours')::interval);
end;
$$;

create or replace function public.revocar_acceso_soporte(acceso_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_empresa_id uuid;
begin
  if public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede quitar el acceso de soporte.';
  end if;
  v_empresa_id := public.mi_empresa_id();

  update public.soporte_accesos
  set revocado_en = now(), revocado_por = auth.uid()
  where id = acceso_id and empresa_id = v_empresa_id and revocado_en is null
  returning otorgado_a into v_user_id;

  if v_user_id is not null then
    delete from public.miembros
    where user_id = v_user_id and es_soporte and empresa_id = v_empresa_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Admin de la plataforma (29/09/2026): quién ve la lista de TODAS las
-- empresas que existen. No tiene nada que ver con ser "dueno" de una
-- empresa — vive en su propia tabla, aparte de "miembros".
-- ---------------------------------------------------------------

create table if not exists public.admins_plataforma (
  user_id uuid primary key references auth.users (id)
);
alter table public.admins_plataforma enable row level security;

create or replace function public.soy_admin_plataforma()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from public.admins_plataforma where user_id = auth.uid());
$$;

create or replace function public.listar_empresas_admin()
returns table (
  id uuid,
  nombre text,
  codigo text,
  created_at timestamptz,
  miembros_count bigint,
  obras_count bigint
)
language sql security definer stable
set search_path = public
as $$
  select
    e.id, e.nombre, e.codigo, e.created_at,
    (select count(*) from public.miembros m where m.empresa_id = e.id and not m.es_soporte) as miembros_count,
    (select count(*) from public.obras o where o.empresa_id = e.id) as obras_count
  from public.empresas e
  where public.soy_admin_plataforma()
  order by e.created_at desc;
$$;

-- (El admin de la plataforma se inserta a mano, ver migracion-admin-plataforma; ya no hay ninguno fijo aquí.)

-- ===============================================================
-- REGISTRO SOLO CON CÓDIGO + SUSCRIPCIÓN (30/09/2026)
-- Redefine mi_rol(), mi_empresa_id(), crear_miembro() y listar_empresas_admin().
-- ===============================================================

-- Registro SOLO con código (30/09/2026).
--
-- Hasta ahora, registrarse sin código creaba una empresa nueva gratis. Como
-- la app será de pago, ahora hay dos clases de código y sin uno de ellos no
-- hay registro:
--   1) Código de EMPRESA (el que ya existe, empresas.codigo): quien se
--      registra entra como trabajador SIN aprobar en esa empresa; el dueño
--      lo aprueba desde Ajustes → Accesos.
--   2) Código de ALTA (nuevo, tabla codigos_alta): lo genera SOLO el admin
--      de la plataforma desde /admin y se lo da al cliente. Es largo,
--      aleatorio y de un solo uso. Quien lo usa crea su propia empresa y es
--      su dueño, con 14 días de prueba. El código queda ligado a la empresa
--      que creó, para verlo en /admin.
--
-- Suscripción: empresas.activa_hasta (null = sin caducidad, como la tuya) y
-- empresas.bloqueada. mi_rol() y mi_empresa_id() —de las que dependen todas
-- las políticas RLS— dejan de devolver nada cuando la empresa está caducada
-- o bloqueada, así que la base de datos deja de dar datos aunque alguien
-- trucara la app. Los datos NO se borran. (Revisado 30/09/2026: las
-- funciones "security definer" que escriben y no miran mi_rol() solo tocan
-- el propio nombre/aviso de quien llama, son disparadores de tablas que ya
-- pasan por RLS, o solo las puede llamar el servidor de pagos — ninguna
-- deja trabajar a una empresa caducada. Probado en prueba-aislamiento.sql.)
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Seguro repetirlo.

alter table public.empresas add column if not exists activa_hasta timestamptz;
alter table public.empresas add column if not exists bloqueada boolean not null default false;

create table if not exists public.codigos_alta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nota text,
  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  cancelado_en timestamptz,
  usado_en timestamptz,
  usado_por uuid references auth.users (id) on delete set null,
  empresa_id uuid references public.empresas (id) on delete set null
);
-- Sin ninguna política a propósito: solo se toca desde las funciones de abajo.
alter table public.codigos_alta enable row level security;

-- ---------------------------------------------------------------
-- Suscripción: mi_rol() y mi_empresa_id() ignoran empresas caducadas/bloqueadas
-- ---------------------------------------------------------------

create or replace function public.mi_rol()
returns text language sql security definer stable
set search_path = public
as $$
  select m.rol from public.miembros m
  where m.user_id = auth.uid() and m.aprobado
    and (
      not m.es_soporte
      or exists (
        select 1 from public.soporte_accesos sa
        where sa.empresa_id = m.empresa_id and sa.otorgado_a = m.user_id
          and sa.revocado_en is null and sa.expira_en > now()
      )
    )
    and exists (
      select 1 from public.empresas e
      where e.id = m.empresa_id and not e.bloqueada
        and (e.activa_hasta is null or e.activa_hasta > now())
    );
$$;

create or replace function public.mi_empresa_id()
returns uuid language sql security definer stable
set search_path = public
as $$
  select m.empresa_id from public.miembros m
  where m.user_id = auth.uid() and m.aprobado
    and (
      not m.es_soporte
      or exists (
        select 1 from public.soporte_accesos sa
        where sa.empresa_id = m.empresa_id and sa.otorgado_a = m.user_id
          and sa.revocado_en is null and sa.expira_en > now()
      )
    )
    and exists (
      select 1 from public.empresas e
      where e.id = m.empresa_id and not e.bloqueada
        and (e.activa_hasta is null or e.activa_hasta > now())
    );
$$;

-- ---------------------------------------------------------------
-- Qué significa el código escrito en el registro (la pantalla lo consulta
-- antes de dejar crear la cuenta). Solo dice el tipo y, si es de empresa,
-- su nombre; nunca datos de nadie.
-- ---------------------------------------------------------------

create or replace function public.comprobar_codigo_registro(p_codigo text)
returns table (tipo text, nombre text)
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_norm = '' then
    return;
  end if;
  if exists (select 1 from public.empresas e where upper(e.codigo) = v_norm and not e.bloqueada) then
    return query select 'empresa'::text, e.nombre from public.empresas e
      where upper(e.codigo) = v_norm and not e.bloqueada limit 1;
  elsif exists (
    select 1 from public.codigos_alta c
    where upper(replace(c.codigo, '-', '')) = v_norm and c.usado_en is null and c.cancelado_en is null
  ) then
    return query select 'alta'::text, null::text;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Alta de usuario: solo con código
-- ---------------------------------------------------------------

create or replace function public.crear_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_empresa text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'empresa_codigo', ''), '[^A-Za-z0-9]', '', 'g'));
  v_codigo_alta text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'codigo_alta', ''), '[^A-Za-z0-9]', '', 'g'));
  v_persona text := nullif(trim(
    coalesce(new.raw_user_meta_data ->> 'nombre', '') || ' ' || coalesce(new.raw_user_meta_data ->> 'apellidos', '')
  ), '');
  v_nombre_empresa text;
  v_empresa_id uuid;
  v_alta_id uuid;
begin
  if v_codigo_empresa <> '' then
    select id into v_empresa_id from public.empresas
    where upper(codigo) = v_codigo_empresa and not bloqueada;
    if v_empresa_id is null then
      raise exception 'codigo_empresa_invalido';
    end if;
    insert into public.miembros (user_id, email, nombre, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), v_persona, 'trabajador', false, v_empresa_id)
    on conflict (user_id) do nothing;

  elsif v_codigo_alta <> '' then
    -- Un solo uso: el update solo prospera si nadie lo ha gastado antes.
    update public.codigos_alta
    set usado_en = now(), usado_por = new.id
    where upper(replace(codigo, '-', '')) = v_codigo_alta
      and usado_en is null and cancelado_en is null
    returning id into v_alta_id;
    if v_alta_id is null then
      raise exception 'codigo_alta_invalido';
    end if;

    v_nombre_empresa := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_empresa'), ''), 'Mi empresa');
    insert into public.empresas (nombre, activa_hasta)
    values (v_nombre_empresa, now() + interval '14 days')
    returning id into v_empresa_id;
    update public.codigos_alta set empresa_id = v_empresa_id where id = v_alta_id;

    insert into public.miembros (user_id, email, nombre, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), v_persona, 'dueno', true, v_empresa_id)
    on conflict (user_id) do nothing;

  else
    raise exception 'codigo_requerido';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Funciones del admin de la plataforma
-- ---------------------------------------------------------------

create or replace function public.crear_codigo_alta(p_nota text default null)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  -- Sin 0/O/1/I para que no se confundan al dictarlo por teléfono.
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
  i int;
begin
  if not public.soy_admin_plataforma() then
    raise exception 'no autorizado';
  end if;
  loop
    v_bytes := gen_random_bytes(12);
    v_codigo := '';
    for i in 0..11 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
      if i in (3, 7) then
        v_codigo := v_codigo || '-';
      end if;
    end loop;
    exit when not exists (select 1 from public.codigos_alta where codigo = v_codigo);
  end loop;
  insert into public.codigos_alta (codigo, nota, creado_por)
  values (v_codigo, nullif(trim(p_nota), ''), auth.uid());
  return v_codigo;
end;
$$;

create or replace function public.listar_codigos_alta()
returns table (
  id uuid,
  codigo text,
  nota text,
  creado_en timestamptz,
  estado text,
  empresa_nombre text,
  usado_en timestamptz
)
language sql security definer stable
set search_path = public
as $$
  select
    c.id, c.codigo, c.nota, c.creado_en,
    case
      when c.usado_en is not null then 'usado'
      when c.cancelado_en is not null then 'cancelado'
      else 'libre'
    end as estado,
    e.nombre as empresa_nombre,
    c.usado_en
  from public.codigos_alta c
  left join public.empresas e on e.id = c.empresa_id
  where public.soy_admin_plataforma()
  order by c.creado_en desc;
$$;

create or replace function public.cancelar_codigo_alta(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.soy_admin_plataforma() then
    raise exception 'no autorizado';
  end if;
  update public.codigos_alta set cancelado_en = now()
  where id = p_id and usado_en is null and cancelado_en is null;
end;
$$;

-- p_activa_hasta null = sin caducidad.
create or replace function public.establecer_suscripcion(
  p_empresa uuid, p_activa_hasta timestamptz, p_bloqueada boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.soy_admin_plataforma() then
    raise exception 'no autorizado';
  end if;
  update public.empresas
  set activa_hasta = p_activa_hasta, bloqueada = coalesce(p_bloqueada, false)
  where id = p_empresa;
end;
$$;

drop function if exists public.listar_empresas_admin();
create or replace function public.listar_empresas_admin()
returns table (
  id uuid,
  nombre text,
  codigo text,
  created_at timestamptz,
  miembros_count bigint,
  obras_count bigint,
  activa_hasta timestamptz,
  bloqueada boolean,
  codigo_alta text
)
language sql security definer stable
set search_path = public
as $$
  select
    e.id, e.nombre, e.codigo, e.created_at,
    (select count(*) from public.miembros m where m.empresa_id = e.id and not m.es_soporte) as miembros_count,
    (select count(*) from public.obras o where o.empresa_id = e.id) as obras_count,
    e.activa_hasta,
    e.bloqueada,
    (select c.codigo from public.codigos_alta c where c.empresa_id = e.id limit 1) as codigo_alta
  from public.empresas e
  where public.soy_admin_plataforma()
  order by e.created_at desc;
$$;

-- ===============================================================
-- PAGO CON TARJETA (STRIPE) PARA EL ALTA (30/09/2026)
-- Redefine crear_codigo_alta(), crear_miembro() y listar_codigos_alta().
-- ===============================================================

-- Etapa 2 (30/09/2026): código de alta comprado con tarjeta (Stripe).
--
-- Flujo: en el registro, "¿No tienes código?" → /alta → pago con Stripe
-- (suscripción mensual con 14 días de prueba) → al volver del pago se
-- genera el código de alta, se enseña en pantalla y queda apuntado en
-- /admin con el email del comprador. Cada mes Stripe avisa (webhook) y
-- se mueve empresas.activa_hasta hasta el final del periodo pagado. Si
-- deja de pagar, la fecha no se renueva y la empresa se bloquea sola
-- (ver migracion-codigos-alta.sql: mi_rol()/mi_empresa_id()).
--
-- Las funciones de aquí las llama SOLO el servidor de la app con la clave
-- service_role (nunca el navegador): por eso se les quita el permiso de
-- ejecución a anon/authenticated.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Seguro repetirlo.

alter table public.codigos_alta add column if not exists email text;
alter table public.codigos_alta add column if not exists stripe_session_id text unique;
alter table public.codigos_alta add column if not exists stripe_customer_id text;
alter table public.codigos_alta add column if not exists stripe_subscription_id text;
-- Hasta cuándo está pagado (o en prueba), según Stripe. Si el código aún
-- no se ha usado, la empresa nace con esta fecha.
alter table public.codigos_alta add column if not exists pagado_hasta timestamptz;
create index if not exists codigos_alta_subscription_idx on public.codigos_alta (stripe_subscription_id);

-- Genera un código libre (sin comprobar quién llama: es interna).
create or replace function public.generar_codigo_alta_libre()
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  -- Sin 0/O/1/I para que no se confundan al dictarlo por teléfono.
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
  i int;
begin
  loop
    v_bytes := gen_random_bytes(12);
    v_codigo := '';
    for i in 0..11 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
      if i in (3, 7) then
        v_codigo := v_codigo || '-';
      end if;
    end loop;
    exit when not exists (select 1 from public.codigos_alta where codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;
revoke execute on function public.generar_codigo_alta_libre() from public, anon, authenticated;

create or replace function public.crear_codigo_alta(p_nota text default null)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  if not public.soy_admin_plataforma() then
    raise exception 'no autorizado';
  end if;
  v_codigo := public.generar_codigo_alta_libre();
  insert into public.codigos_alta (codigo, nota, creado_por)
  values (v_codigo, nullif(trim(p_nota), ''), auth.uid());
  return v_codigo;
end;
$$;

-- Pago terminado: devuelve el código de ESE pago (lo crea la primera vez;
-- si el webhook y la pantalla de "pago hecho" llegan los dos, el segundo
-- recibe el mismo código).
create or replace function public.registrar_pago_alta(
  p_session text, p_email text, p_customer text, p_subscription text, p_pagado_hasta timestamptz
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  select codigo into v_codigo from public.codigos_alta where stripe_session_id = p_session;
  if v_codigo is not null then
    return v_codigo;
  end if;
  v_codigo := public.generar_codigo_alta_libre();
  insert into public.codigos_alta
    (codigo, nota, email, stripe_session_id, stripe_customer_id, stripe_subscription_id, pagado_hasta)
  values
    (v_codigo, 'Pago con tarjeta', p_email, p_session, p_customer, p_subscription, p_pagado_hasta)
  on conflict (stripe_session_id) do nothing;
  select codigo into v_codigo from public.codigos_alta where stripe_session_id = p_session;
  return v_codigo;
end;
$$;
revoke execute on function public.registrar_pago_alta(text, text, text, text, timestamptz) from public, anon, authenticated;

-- Stripe avisa de un cambio en la suscripción: se apunta hasta cuándo está
-- pagada y se lo pasa a la empresa (si ya existe). Nunca toca una empresa
-- sin caducidad (activa_hasta null, como la tuya).
create or replace function public.actualizar_pago_suscripcion(p_subscription text, p_pagado_hasta timestamptz)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.codigos_alta set pagado_hasta = p_pagado_hasta
  where stripe_subscription_id = p_subscription;

  update public.empresas e set activa_hasta = p_pagado_hasta
  from public.codigos_alta c
  where c.stripe_subscription_id = p_subscription
    and c.empresa_id = e.id
    and e.activa_hasta is not null;
end;
$$;
revoke execute on function public.actualizar_pago_suscripcion(text, timestamptz) from public, anon, authenticated;

-- Alta: la empresa nace con la fecha pagada (si el código viene de un pago)
-- o con 14 días de prueba (si es un código dado a mano desde /admin).
create or replace function public.crear_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_empresa text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'empresa_codigo', ''), '[^A-Za-z0-9]', '', 'g'));
  v_codigo_alta text := upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'codigo_alta', ''), '[^A-Za-z0-9]', '', 'g'));
  v_persona text := nullif(trim(
    coalesce(new.raw_user_meta_data ->> 'nombre', '') || ' ' || coalesce(new.raw_user_meta_data ->> 'apellidos', '')
  ), '');
  v_nombre_empresa text;
  v_empresa_id uuid;
  v_alta_id uuid;
  v_pagado_hasta timestamptz;
begin
  if v_codigo_empresa <> '' then
    select id into v_empresa_id from public.empresas
    where upper(codigo) = v_codigo_empresa and not bloqueada;
    if v_empresa_id is null then
      raise exception 'codigo_empresa_invalido';
    end if;
    insert into public.miembros (user_id, email, nombre, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), v_persona, 'trabajador', false, v_empresa_id)
    on conflict (user_id) do nothing;

  elsif v_codigo_alta <> '' then
    -- Un solo uso: el update solo prospera si nadie lo ha gastado antes.
    update public.codigos_alta
    set usado_en = now(), usado_por = new.id
    where upper(replace(codigo, '-', '')) = v_codigo_alta
      and usado_en is null and cancelado_en is null
    returning id, pagado_hasta into v_alta_id, v_pagado_hasta;
    if v_alta_id is null then
      raise exception 'codigo_alta_invalido';
    end if;

    v_nombre_empresa := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_empresa'), ''), 'Mi empresa');
    insert into public.empresas (nombre, activa_hasta)
    values (v_nombre_empresa, coalesce(v_pagado_hasta, now() + interval '14 days'))
    returning id into v_empresa_id;
    update public.codigos_alta set empresa_id = v_empresa_id where id = v_alta_id;

    insert into public.miembros (user_id, email, nombre, rol, aprobado, empresa_id)
    values (new.id, coalesce(new.email, ''), v_persona, 'dueno', true, v_empresa_id)
    on conflict (user_id) do nothing;

  else
    raise exception 'codigo_requerido';
  end if;

  return new;
end;
$$;

drop function if exists public.listar_codigos_alta();
create or replace function public.listar_codigos_alta()
returns table (
  id uuid,
  codigo text,
  nota text,
  creado_en timestamptz,
  estado text,
  empresa_nombre text,
  usado_en timestamptz,
  email text,
  pagado boolean
)
language sql security definer stable
set search_path = public
as $$
  select
    c.id, c.codigo, c.nota, c.creado_en,
    case
      when c.usado_en is not null then 'usado'
      when c.cancelado_en is not null then 'cancelado'
      else 'libre'
    end as estado,
    e.nombre as empresa_nombre,
    c.usado_en,
    c.email,
    c.stripe_session_id is not null as pagado
  from public.codigos_alta c
  left join public.empresas e on e.id = c.empresa_id
  where public.soy_admin_plataforma()
  order by c.creado_en desc;
$$;

-- ===============================================================
-- MÓDULOS POR EMPRESA (punto 18, 30/09/2026)
-- ===============================================================

-- Punto 18 (30/09/2026): módulos que cada empresa enciende o apaga desde
-- Ajustes → Módulos. Todos encendidos por defecto, así nada cambia para
-- quien ya usa la app. Solo esconden pantallas y botones: no son un
-- permiso de seguridad (eso sigue en RLS).
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Seguro repetirlo.

alter table public.ajustes add column if not exists mod_vehiculos boolean not null default true;
alter table public.ajustes add column if not exists mod_notas_voz boolean not null default true;
alter table public.ajustes add column if not exists mod_caja_jefe boolean not null default true;
alter table public.ajustes add column if not exists mod_transporte boolean not null default true;
alter table public.ajustes add column if not exists mod_geolocalizacion boolean not null default true;

-- ===============================================================
-- REGISTRO DE ERRORES (Fase 4, punto 24, 30/09/2026)
-- ===============================================================

-- Fase 4, punto 24 (30/09/2026): registro de errores propio, sin servicios
-- de fuera (nada que contratar y los datos se quedan en la UE, igual que la
-- base). La app manda aquí los fallos del navegador y del servidor; el
-- admin de la plataforma los ve en /admin.
--
-- Cualquiera puede ESCRIBIR un error (también sin sesión: pasa en el login),
-- pero solo a través de registrar_error(), que recorta los textos, no deja
-- más de 300 por hora y borra los de más de 90 días. Nadie puede LEERLOS
-- salvo el admin de la plataforma.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Seguro repetirlo.

create table if not exists public.errores_app (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  origen text not null,               -- 'navegador' | 'servidor'
  mensaje text not null,
  detalle text,                       -- pila de llamadas, recortada
  ruta text,
  navegador text,
  user_id uuid,
  empresa_id uuid
);
create index if not exists errores_app_creado_idx on public.errores_app (creado_en desc);
alter table public.errores_app enable row level security;

create or replace function public.registrar_error(
  p_origen text, p_mensaje text, p_detalle text default null, p_ruta text default null, p_navegador text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if (select count(*) from public.errores_app where creado_en > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.errores_app (origen, mensaje, detalle, ruta, navegador, user_id, empresa_id)
  values (
    case when p_origen = 'servidor' then 'servidor' else 'navegador' end,
    left(coalesce(nullif(trim(p_mensaje), ''), '(sin mensaje)'), 500),
    left(p_detalle, 4000),
    left(p_ruta, 300),
    left(p_navegador, 300),
    auth.uid(),
    public.mi_empresa_id()
  );
  -- Limpieza de paso (1 de cada 50 veces, para no hacerlo siempre).
  if random() < 0.02 then
    delete from public.errores_app where creado_en < now() - interval '90 days';
  end if;
end;
$$;
grant execute on function public.registrar_error(text, text, text, text, text) to anon, authenticated;

create or replace function public.listar_errores_admin(p_limite int default 100)
returns table (
  id bigint, creado_en timestamptz, origen text, mensaje text, detalle text,
  ruta text, navegador text, email text, empresa text
)
language sql security definer stable
set search_path = public
as $$
  select e.id, e.creado_en, e.origen, e.mensaje, e.detalle, e.ruta, e.navegador,
         u.email::text, em.nombre
  from public.errores_app e
  left join auth.users u on u.id = e.user_id
  left join public.empresas em on em.id = e.empresa_id
  where public.soy_admin_plataforma()
  order by e.creado_en desc
  limit least(greatest(p_limite, 1), 500);
$$;

create or replace function public.borrar_errores_admin()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.soy_admin_plataforma() then
    raise exception 'no autorizado';
  end if;
  delete from public.errores_app where true;
end;
$$;

-- (30/09/2026) Las tres comprobaciones "solo el dueño" pasan a "is distinct from": ver migracion-corregir-chequeo-dueno.sql.
