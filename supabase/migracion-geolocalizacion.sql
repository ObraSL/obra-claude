-- Puntos 9 y 10 del plan: geolocalización al fichar (dentro/fuera del radio
-- de la obra, SIN guardar coordenadas exactas cada vez — solo el resultado
-- y la distancia) + regla de tiempo mínimo antes del turno + aviso al
-- trabajador con confirmación de lectura antes de empezar a fichar.
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

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

-- Regla de tiempo mínimo: no se puede fichar la entrada de hoy antes de
-- (hora_inicio_turno − minutos_antes_permitidos). Solo si la obra tiene
-- hora_inicio_turno puesta; el dueño no tiene esta restricción (igual que
-- ya podía saltarse el resto de reglas de horario, para poder corregir).
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
