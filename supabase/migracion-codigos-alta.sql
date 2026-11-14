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
