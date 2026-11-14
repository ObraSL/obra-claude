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
