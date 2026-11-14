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
