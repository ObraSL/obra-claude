-- Pedido tras el punto 19: una página solo para ti (la dueña de la app, no
-- de una empresa-cliente) con la lista de TODAS las empresas que existen en
-- la plataforma — para saber quién se ha registrado, cuántas hay y cómo
-- van, sin meterte dentro de ninguna sin que su dueño te dé acceso (eso ya
-- lo hace el punto 17, "acceso de soporte").
--
-- Quién es "admin de la plataforma" vive en una tabla aparte, no en
-- "miembros": no tiene nada que ver con ser dueño de una empresa.
--
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

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

-- Tu propia cuenta como primera (y hoy única) admin de la plataforma.
insert into public.admins_plataforma (user_id)
values ('abb4ffcb-be2e-43e6-9ffc-633924c57aa1')
on conflict (user_id) do nothing;
