-- Encontrado en la prueba de choque (30/09/2026): en tres funciones la
-- comprobación "solo el dueño" era  mi_rol() <> 'dueno'.  Para quien no
-- tiene rol (sin sesión, trabajador pendiente, empresa caducada) mi_rol() es
-- NULL, y  NULL <> 'dueno'  no es verdadero: la comprobación no paraba a
-- nadie. Lo frenaban otras cosas más abajo (la obra tiene que ser de tu
-- empresa, campos obligatorios…), así que no se podía romper ni leer nada,
-- pero dar_acceso_soporte() sí dejaba averiguar si un email tiene cuenta.
-- Ahora es  "is distinct from", que con NULL también para.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Seguro repetirlo.

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

