-- Punto 17 del plan: una cuenta de soporte para el desarrollador (no
-- "dueño") que cada empresa-cliente da y quita ella misma, con caducidad
-- automática y un registro de quién dio y quitó el acceso y cuándo.
--
-- Cómo funciona por dentro: el acceso se apoya en una fila normal de
-- "miembros" (con rol 'dueno', porque es lo que hace falta para poder
-- ayudar de verdad), pero marcada aparte con "es_soporte = true" y atada a
-- un registro en "soporte_accesos" con su fecha de caducidad. mi_rol() y
-- mi_empresa_id() —de las que dependen TODAS las políticas de la app—
-- dejan de contar esa fila en cuanto caduca o se revoca, así que el acceso
-- se apaga solo, sin depender de ningún proceso aparte que borre nada.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

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

-- ---------------------------------------------------------------
-- mi_rol() / mi_empresa_id(): una fila de soporte solo cuenta mientras su
-- acceso siga activo (ni caducado ni revocado).
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

-- ---------------------------------------------------------------
-- Dar y quitar acceso: solo el dueño de la empresa, y solo a una cuenta ya
-- registrada en la app (para no crear cuentas nuevas desde aquí).
-- ---------------------------------------------------------------

create or replace function public.dar_acceso_soporte(email_soporte text, horas integer default 24)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_empresa_id uuid;
begin
  if public.mi_rol() <> 'dueno' then
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
  if public.mi_rol() <> 'dueno' then
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
