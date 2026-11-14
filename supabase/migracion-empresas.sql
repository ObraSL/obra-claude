-- Fase 2, punto 13: tabla "empresas" y empresa_id en las 7 tablas que hacen
-- falta para separar los datos de cada cliente futuro. Ahora mismo solo hay
-- una empresa (la tuya): se crea esa fila y todo lo que ya existe se le
-- asigna. Nada cambia en cómo funciona la app todavía — eso es el punto 14,
-- que reescribe las funciones de acceso para que miren empresa_id.
-- Pega este archivo entero en Supabase → SQL Editor → Run. Es seguro volver
-- a ejecutarlo. Lo mismo está en schema.sql.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  v_empresa_id uuid;
begin
  select id into v_empresa_id from public.empresas order by created_at limit 1;

  if v_empresa_id is null then
    insert into public.empresas (nombre) values ('Mi empresa') returning id into v_empresa_id;
  end if;

  alter table public.obras add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.trabajadores add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.vehiculos add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.proveedores add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.entregas add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.ajustes add column if not exists empresa_id uuid references public.empresas (id);
  alter table public.miembros add column if not exists empresa_id uuid references public.empresas (id);

  update public.obras set empresa_id = v_empresa_id where empresa_id is null;
  update public.trabajadores set empresa_id = v_empresa_id where empresa_id is null;
  update public.vehiculos set empresa_id = v_empresa_id where empresa_id is null;
  update public.proveedores set empresa_id = v_empresa_id where empresa_id is null;
  update public.entregas set empresa_id = v_empresa_id where empresa_id is null;
  update public.ajustes set empresa_id = v_empresa_id where empresa_id is null;
  update public.miembros set empresa_id = v_empresa_id where empresa_id is null;
end $$;

alter table public.obras alter column empresa_id set not null;
alter table public.trabajadores alter column empresa_id set not null;
alter table public.vehiculos alter column empresa_id set not null;
alter table public.proveedores alter column empresa_id set not null;
alter table public.entregas alter column empresa_id set not null;
alter table public.ajustes alter column empresa_id set not null;
alter table public.miembros alter column empresa_id set not null;

create index if not exists obras_empresa_idx on public.obras (empresa_id);
create index if not exists trabajadores_empresa_idx on public.trabajadores (empresa_id);
create index if not exists vehiculos_empresa_idx on public.vehiculos (empresa_id);
create index if not exists proveedores_empresa_idx on public.proveedores (empresa_id);
create index if not exists entregas_empresa_idx on public.entregas (empresa_id);
create index if not exists miembros_empresa_idx on public.miembros (empresa_id);

alter table public.empresas enable row level security;
drop policy if exists "empresas propia" on public.empresas;
create policy "empresas propia" on public.empresas
  for select using (
    id in (select empresa_id from public.miembros where user_id = auth.uid() and aprobado)
  );
