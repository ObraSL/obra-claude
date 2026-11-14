-- Journal de correcciones de horas + confirmación del trabajador (Fase 1,
-- puntos 6 y 7 del plan). Pega este archivo entero en Supabase → SQL Editor
-- → Run. Es seguro volver a ejecutarlo. Lo mismo está en schema.sql.
--
-- Hasta ahora solo había una marca sí/no ("hora_corregida"): se sabía que el
-- dueño había tocado la hora, pero no quién, cuándo, ni cuál era el valor
-- antes de tocarla. Esto añade:
--   1) fichajes_historial: una fila por cada corrección, con el antes y el
--      después. Se rellena sola, con un trigger — nadie tiene que acordarse
--      de apuntar nada.
--   2) fichajes.confirmado_trabajador: cuando el dueño corrige una hora, se
--      pone en false. El trabajador la ve en su móvil y toca "Confirmo" — o
--      no la toca, y el dueño ve que sigue sin confirmar.

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

create index if not exists fichajes_historial_fichaje_idx
  on public.fichajes_historial (fichaje_id, cambiado_en desc);

-- Se ejecuta DESPUÉS de "proteger_horas_fichaje" (orden alfabético de los
-- triggers "before"), así que ve ya aplicadas sus reglas: si un trabajador
-- intenta tocar una hora ya fichada, esa función corta antes con una
-- excepción y esta ni se entera.
create or replace function public.registrar_correccion_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- El dueño apunta a mano un día que el trabajador nunca fichó.
    if new.hora_corregida then
      insert into public.fichajes_historial
        (fichaje_id, obra_id, trabajador_id, fecha,
         hora_entrada_antes, hora_salida_antes,
         hora_entrada_despues, hora_salida_despues, cambiado_por)
      values
        (new.id, new.obra_id, new.trabajador_id, new.fecha,
         null, null, new.hora_entrada, new.hora_salida, auth.uid());
      new.confirmado_trabajador := false;
    end if;
    return new;
  end if;

  if old.hora_entrada is distinct from new.hora_entrada
     or old.hora_salida is distinct from new.hora_salida then
    insert into public.fichajes_historial
      (fichaje_id, obra_id, trabajador_id, fecha,
       hora_entrada_antes, hora_salida_antes,
       hora_entrada_despues, hora_salida_despues, cambiado_por)
    values
      (new.id, new.obra_id, new.trabajador_id, new.fecha,
       old.hora_entrada, old.hora_salida, new.hora_entrada, new.hora_salida, auth.uid());
    new.confirmado_trabajador := false;
  end if;

  return new;
end;
$$;

drop trigger if exists registrar_correccion_fichaje on public.fichajes;
create trigger registrar_correccion_fichaje
  before insert or update on public.fichajes
  for each row execute function public.registrar_correccion_fichaje();

-- Quién ve el historial: los mismos que gestionan la obra, y el propio
-- trabajador solo el suyo (para poder confirmar con conocimiento). Nadie
-- inserta filas a mano: eso solo lo hace el trigger de arriba.
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
