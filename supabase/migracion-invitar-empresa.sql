-- Adelanto del punto 19 (Fase 3), pedido ahora para poder probar de verdad
-- que dos empresas no se tocan: un enlace para invitar al dueño de una
-- empresa nueva, y desde ahí, otro enlace de esa empresa para invitar a su
-- equipo. Antes de esto, CUALQUIER registro (con o sin invitación) se unía
-- siempre a la primera empresa que existiera — bien para una sola empresa,
-- mal en cuanto hay más de una.
--
-- Cómo queda el registro:
--   - Con código de invitación en el enlace (?empresa=XXXXXXXX): se une a
--     esa empresa como trabajador pendiente, igual que hasta ahora.
--   - Sin código: crea su PROPIA empresa nueva y es su dueño.
--
-- IMPORTANTE: a partir de ahora, el enlace suelto (sin ?empresa=...) crea
-- una empresa nueva. Para invitar a tu propio equipo hace falta el enlace
-- con tu código (se ve en Ajustes → Accesos).
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

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

-- Consulta pública y segura: antes de registrarse, alguien con un enlace de
-- invitación necesita saber a qué empresa se va a unir. Solo enseña el
-- nombre, nada más.
create or replace function public.nombre_empresa_por_codigo(p_codigo text)
returns text
language sql security definer stable
set search_path = public
as $$
  select nombre from public.empresas where codigo = p_codigo;
$$;

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
