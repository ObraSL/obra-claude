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
