-- Punto 15: test de aislamiento entre empresas + bloqueo por suscripción.
-- Repetir antes de cada release que toque RLS o mi_rol()/mi_empresa_id().
--
-- NO deja nada guardado: el bloque termina SIEMPRE con un error que lleva
-- el resultado dentro, así que Postgres deshace la transacción entera
-- (la empresa de prueba, el cambio de rol y la caducidad no llegan a existir).
--
-- Resultado correcto (30/09/2026):
--   1_otra_empresa: todo 0 salvo empresas=1 y miembros=1 (los suyos propios)
--   2_caducada:     igual que 1 (la empresa caducada no ve ni sus datos)
--   3_dueno_normal: los datos de verdad de la empresa (obras>0, gastos>0…)
-- Si cambia el dueño o la empresa, cambiar los dos uuid de abajo.
do $$
declare
  v_empresa uuid := '78c321cb-c147-47fb-86ce-24bef935cac8';  -- Mi empresa
  v_dueno uuid := 'abb4ffcb-be2e-43e6-9ffc-633924c57aa1';    -- su dueño
  v_otro uuid;
  v_test uuid;
  r1 jsonb; r2 jsonb; r3 jsonb;
  q text := $q$select jsonb_build_object(
    'obras',(select count(*) from public.obras),'trabajadores',(select count(*) from public.trabajadores),
    'vehiculos',(select count(*) from public.vehiculos),'proveedores',(select count(*) from public.proveedores),
    'entregas',(select count(*) from public.entregas),'ajustes',(select count(*) from public.ajustes),
    'gastos',(select count(*) from public.gastos),'fichajes',(select count(*) from public.fichajes),
    'facturas',(select count(*) from public.facturas),'tareas',(select count(*) from public.tareas),
    'usos_vehiculo',(select count(*) from public.usos_vehiculo),'notas_audio',(select count(*) from public.notas_audio),
    'cobros',(select count(*) from public.cobros),'miembros',(select count(*) from public.miembros),
    'empresas',(select count(*) from public.empresas),'codigos_alta',(select count(*) from public.codigos_alta))$q$;
begin
  select user_id into v_otro from public.miembros
   where empresa_id = v_empresa and user_id <> v_dueno and not es_soporte limit 1;

  -- 3) el dueño real ve lo suyo
  perform set_config('request.jwt.claim.sub', v_dueno::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  execute q into r3;
  execute 'reset role';

  -- 1) otra persona, puesta como DUEÑA de una empresa nueva, no ve nada de la real
  insert into public.empresas (nombre) values ('__TEST__') returning id into v_test;
  update public.miembros set empresa_id = v_test, rol = 'dueno', aprobado = true where user_id = v_otro;
  perform set_config('request.jwt.claim.sub', v_otro::text, true);
  execute 'set local role authenticated';
  execute q into r1;
  execute 'reset role';

  -- 2) la empresa real, caducada: su dueño ya no ve nada
  update public.empresas set activa_hasta = now() - interval '1 day' where id = v_empresa;
  perform set_config('request.jwt.claim.sub', v_dueno::text, true);
  execute 'set local role authenticated';
  execute q into r2;
  execute 'reset role';

  raise exception 'RESULTADO|| 1_otra_empresa=% || 2_caducada=% || 3_dueno_normal=%', r1, r2, r3;
end $$;
