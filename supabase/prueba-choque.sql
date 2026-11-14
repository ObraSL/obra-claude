-- Prueba de choque (30/09/2026): empresas y personas de mentira pasan por
-- todo el camino (alta con código, trabajador que se une, aprobar, fichar,
-- gastos, admin) y luego intentan saltarse las reglas: leer o tocar la
-- empresa real, hacerse dueño, darse suscripción infinita, usar funciones
-- de admin, reutilizar códigos…
--
-- NO deja nada guardado: el bloque termina SIEMPRE con un error que lleva
-- el resultado dentro, así que Postgres deshace la transacción entera
-- (usuarios, empresas, obras y códigos de prueba no llegan a existir).
-- Cada línea del resultado sale "OK" o "FALLO: …".
--
-- Pega en Supabase → SQL Editor → Run. Si cambia la empresa real o el admin,
-- cambiar los uuid de abajo.
do $$
declare
  v_real uuid := '78c321cb-c147-47fb-86ce-24bef935cac8';   -- Mi empresa (la de verdad)
  v_admin uuid := 'de3d64cc-92e6-41bb-bfad-e72f180d7d70';  -- admin de la plataforma
  u_d1 uuid := gen_random_uuid();  -- dueño de la empresa de prueba 1
  u_d2 uuid := gen_random_uuid();  -- dueño de la empresa de prueba 2
  u_w1 uuid := gen_random_uuid();  -- trabajador que se une a la 1
  u_x  uuid := gen_random_uuid();  -- intentos de alta fallidos
  e1 uuid; e2 uuid; o1 uuid; t1 uuid; t_otro uuid; obra_real uuid;
  cod1 text; cod2 text; cod_e1 text;
  n int; m text; j jsonb;
  res jsonb := '{}'::jsonb;
  real_antes jsonb; real_despues jsonb;
  q_real text := $q$select jsonb_build_object(
    'obras',(select count(*) from public.obras where empresa_id = '78c321cb-c147-47fb-86ce-24bef935cac8'),
    'nombres',(select string_agg(nombre, '|' order by id) from public.obras where empresa_id = '78c321cb-c147-47fb-86ce-24bef935cac8'),
    'gastos',(select count(*) from public.gastos g join public.obras o on o.id = g.obra_id where o.empresa_id = '78c321cb-c147-47fb-86ce-24bef935cac8'),
    'miembros',(select count(*) from public.miembros where empresa_id = '78c321cb-c147-47fb-86ce-24bef935cac8'),
    'roles',(select string_agg(rol || aprobado::text, '|' order by user_id) from public.miembros where empresa_id = '78c321cb-c147-47fb-86ce-24bef935cac8'),
    'suscripcion',(select coalesce(activa_hasta::text, 'sin caducidad') || bloqueada::text from public.empresas where id = '78c321cb-c147-47fb-86ce-24bef935cac8'))$q$;
begin
  execute q_real into real_antes;
  select id into obra_real from public.obras where empresa_id = v_real limit 1;

  -- ====== 1. El admin crea dos códigos de alta ======
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  execute 'set local role authenticated';
  cod1 := public.crear_codigo_alta('prueba 1');
  cod2 := public.crear_codigo_alta('prueba 2');
  execute 'reset role';
  res := res || jsonb_build_object('01 admin crea códigos', case when cod1 ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$' then 'OK' else 'FALLO: ' || coalesce(cod1, 'null') end);

  -- ====== 2. Altas ======
  insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
  values (u_d1, 'prueba-d1@ejemplo.invalid', 'authenticated', 'authenticated',
          jsonb_build_object('codigo_alta', lower(replace(cod1, '-', '')), 'nombre_empresa', '__PRUEBA Empresa Uno', 'nombre', 'Dueño', 'apellidos', 'Uno'), now());
  select empresa_id into e1 from public.miembros where user_id = u_d1 and rol = 'dueno' and aprobado;
  select codigo into cod_e1 from public.empresas where id = e1;
  res := res || jsonb_build_object('02 alta con código (minúsculas, sin guiones) crea empresa y dueño',
    case when e1 is not null and (select activa_hasta between now() + interval '13 days' and now() + interval '15 days' from public.empresas where id = e1)
              and (select nombre from public.miembros where user_id = u_d1) = 'Dueño Uno'
         then 'OK' else 'FALLO' end);
  res := res || jsonb_build_object('03 el código queda gastado y apuntado a su empresa',
    case when (select usado_en is not null and empresa_id = e1 from public.codigos_alta where codigo = cod1) then 'OK' else 'FALLO' end);

  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
    values (u_x, 'prueba-x@ejemplo.invalid', 'authenticated', 'authenticated', jsonb_build_object('codigo_alta', cod1), now());
    res := res || jsonb_build_object('04 reutilizar un código gastado', 'FALLO: se dejó registrar');
  exception when others then
    res := res || jsonb_build_object('04 reutilizar un código gastado', case when sqlerrm like '%codigo_alta_invalido%' then 'OK' else 'FALLO: ' || sqlerrm end);
  end;
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
    values (u_x, 'prueba-x@ejemplo.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
    res := res || jsonb_build_object('05 registro sin código', 'FALLO: se dejó registrar');
  exception when others then
    res := res || jsonb_build_object('05 registro sin código', case when sqlerrm like '%codigo_requerido%' then 'OK' else 'FALLO: ' || sqlerrm end);
  end;
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
    values (u_x, 'prueba-x@ejemplo.invalid', 'authenticated', 'authenticated', jsonb_build_object('codigo_alta', 'AAAA-BBBB-CCCC'), now());
    res := res || jsonb_build_object('06 código inventado', 'FALLO: se dejó registrar');
  exception when others then
    res := res || jsonb_build_object('06 código inventado', case when sqlerrm like '%codigo_alta_invalido%' then 'OK' else 'FALLO: ' || sqlerrm end);
  end;
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
    values (u_x, 'prueba-x@ejemplo.invalid', 'authenticated', 'authenticated', jsonb_build_object('empresa_codigo', 'zzzzzzzz'), now());
    res := res || jsonb_build_object('07 código de empresa inventado', 'FALLO: se dejó registrar');
  exception when others then
    res := res || jsonb_build_object('07 código de empresa inventado', case when sqlerrm like '%codigo_empresa_invalido%' then 'OK' else 'FALLO: ' || sqlerrm end);
  end;

  insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
  values (u_d2, 'prueba-d2@ejemplo.invalid', 'authenticated', 'authenticated',
          jsonb_build_object('codigo_alta', cod2, 'nombre_empresa', '__PRUEBA Empresa Dos'), now());
  select empresa_id into e2 from public.miembros where user_id = u_d2;

  insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
  values (u_w1, 'prueba-w1@ejemplo.invalid', 'authenticated', 'authenticated',
          jsonb_build_object('empresa_codigo', upper(cod_e1), 'nombre', 'Obrero', 'apellidos', 'Prueba'), now());
  res := res || jsonb_build_object('08 trabajador se une con el código de empresa (pendiente)',
    case when (select empresa_id = e1 and rol = 'trabajador' and not aprobado from public.miembros where user_id = u_w1) then 'OK' else 'FALLO' end);

  -- ====== 3. El trabajador pendiente no ve nada ======
  perform set_config('request.jwt.claim.sub', u_w1::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.obras;
  res := res || jsonb_build_object('09 pendiente no ve obras', case when n = 0 and public.mi_rol() is null then 'OK' else 'FALLO: ' || n end);

  begin
    perform public.dar_acceso_soporte('prueba-d2@ejemplo.invalid', 1);
    res := res || jsonb_build_object('09b pendiente no puede dar acceso de soporte', 'FALLO: lo dio');
  exception when others then
    res := res || jsonb_build_object('09b pendiente no puede dar acceso de soporte (ni saber si un email existe)',
      case when sqlerrm like 'Solo el dueño%' then 'OK' else 'FALLO: ' || sqlerrm end);
  end;
  execute 'reset role';

  -- ====== 4. El dueño 1 trabaja con su empresa ======
  perform set_config('request.jwt.claim.sub', u_d1::text, true);
  execute 'set local role authenticated';
  insert into public.obras (owner_id, nombre, activa) values (u_d1, '__PRUEBA Obra', true) returning id into o1;
  insert into public.trabajadores (owner_id, nombre) values (u_d1, '__PRUEBA Obrero') returning id into t1;
  insert into public.trabajadores (owner_id, nombre) values (u_d1, '__PRUEBA Otro') returning id into t_otro;
  update public.miembros set aprobado = true, trabajador_id = t1 where user_id = u_w1;
  insert into public.gastos (obra_id, importe, concepto, categoria, fecha) values (o1, 123.45, 'cemento', 'Material', current_date);
  insert into public.cobros (obra_id, importe, fecha) values (o1, 1000, current_date);
  res := res || jsonb_build_object('10 dueño crea obra, trabajadores, gasto y cobro (van a SU empresa)',
    case when (select empresa_id from public.obras where id = o1) = e1 and (select count(*) from public.gastos where obra_id = o1) = 1 then 'OK' else 'FALLO' end);

  -- ====== 5. El dueño 1 ataca a la empresa real ======
  select count(*) into n from public.obras where empresa_id = v_real;
  res := res || jsonb_build_object('11 no ve obras de la empresa real', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  select count(*) into n from public.gastos where obra_id = obra_real;
  res := res || jsonb_build_object('12 no ve gastos de la empresa real', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  select count(*) into n from public.miembros where empresa_id = v_real;
  res := res || jsonb_build_object('13 no ve las personas de la empresa real', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  update public.obras set nombre = 'HACKEADO' where empresa_id = v_real;
  get diagnostics n = row_count;
  res := res || jsonb_build_object('14 no puede cambiar obras reales', case when n = 0 then 'OK' else 'FALLO: cambió ' || n end);
  delete from public.gastos where obra_id = obra_real;
  get diagnostics n = row_count;
  res := res || jsonb_build_object('15 no puede borrar gastos reales', case when n = 0 then 'OK' else 'FALLO: borró ' || n end);
  begin
    insert into public.obras (owner_id, nombre, activa, empresa_id) values (u_d1, 'intrusa', true, v_real);
    res := res || jsonb_build_object('16 no puede meter una obra en la empresa real', 'FALLO: la metió');
  exception when others then res := res || jsonb_build_object('16 no puede meter una obra en la empresa real', 'OK'); end;
  begin
    insert into public.gastos (obra_id, importe, concepto, categoria, fecha) values (obra_real, 1, 'x', 'Otros', current_date);
    res := res || jsonb_build_object('17 no puede apuntar gastos en una obra real', 'FALLO: lo apuntó');
  exception when others then res := res || jsonb_build_object('17 no puede apuntar gastos en una obra real', 'OK'); end;
  begin
    update public.miembros set empresa_id = v_real where user_id = u_d1;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('18 no puede mudarse a la empresa real', case when n = 0 then 'OK' else 'FALLO: se mudó' end);
  exception when others then res := res || jsonb_build_object('18 no puede mudarse a la empresa real', 'OK'); end;
  begin
    perform public.eliminar_obra(obra_real);
    res := res || jsonb_build_object('19 no puede borrar una obra real', 'FALLO: la borró');
  exception when others then res := res || jsonb_build_object('19 no puede borrar una obra real', 'OK'); end;
  begin
    perform public.establecer_suscripcion(e1, null, false);
    res := res || jsonb_build_object('20 no puede darse suscripción infinita', 'FALLO: se la dio');
  exception when others then res := res || jsonb_build_object('20 no puede darse suscripción infinita', 'OK'); end;
  begin
    perform public.crear_codigo_alta('pirata');
    res := res || jsonb_build_object('21 no puede crear códigos de alta', 'FALLO: lo creó');
  exception when others then res := res || jsonb_build_object('21 no puede crear códigos de alta', 'OK'); end;
  select count(*) into n from public.listar_empresas_admin();
  res := res || jsonb_build_object('22 no ve la lista de empresas del admin', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  select count(*) into n from public.listar_errores_admin();
  res := res || jsonb_build_object('23 no ve la lista de errores del admin', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  begin
    insert into public.admins_plataforma (user_id) values (u_d1);
    res := res || jsonb_build_object('24 no puede hacerse admin', 'FALLO: se hizo admin');
  exception when others then res := res || jsonb_build_object('24 no puede hacerse admin', 'OK'); end;
  begin
    update public.empresas set activa_hasta = null where id = e1;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('25 no puede tocar su suscripción directamente', case when n = 0 then 'OK' else 'FALLO' end);
  exception when others then res := res || jsonb_build_object('25 no puede tocar su suscripción directamente', 'OK'); end;
  execute 'reset role';

  -- ====== 6. El trabajador aprobado ======
  perform set_config('request.jwt.claim.sub', u_w1::text, true);
  execute 'set local role authenticated';
  insert into public.fichajes (obra_id, trabajador_id, fecha, hora_entrada) values (o1, t1, current_date, '08:00');
  res := res || jsonb_build_object('26 trabajador ficha sus horas', 'OK');
  begin
    insert into public.fichajes (obra_id, trabajador_id, fecha, hora_entrada) values (o1, t_otro, current_date, '08:00');
    res := res || jsonb_build_object('27 no puede fichar por otro', 'FALLO: fichó por otro');
  exception when others then res := res || jsonb_build_object('27 no puede fichar por otro', 'OK'); end;
  select count(*) into n from public.gastos;
  res := res || jsonb_build_object('28 trabajador no ve gastos', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  select count(*) into n from public.cobros;
  res := res || jsonb_build_object('29 trabajador no ve lo que paga el cliente', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  delete from public.fichajes where trabajador_id = t1;
  get diagnostics n = row_count;
  res := res || jsonb_build_object('30 trabajador no puede borrar su fichaje', case when n = 0 then 'OK' else 'FALLO: lo borró' end);
  update public.miembros set rol = 'dueno' where user_id = u_w1;
  get diagnostics n = row_count;
  res := res || jsonb_build_object('31 trabajador no puede hacerse dueño', case when n = 0 and public.mi_rol() = 'trabajador' then 'OK' else 'FALLO' end);
  execute 'reset role';

  -- ====== 7. La otra empresa de prueba no ve la 1 ======
  perform set_config('request.jwt.claim.sub', u_d2::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.obras where id = o1;
  res := res || jsonb_build_object('32 empresa 2 no ve nada de la empresa 1', case when n = 0 and (select count(*) from public.fichajes) = 0 then 'OK' else 'FALLO' end);
  execute 'reset role';

  -- ====== 8. El admin ve todas las empresas y los códigos ======
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.listar_empresas_admin() where id in (e1, e2, v_real);
  res := res || jsonb_build_object('33 admin ve las 2 empresas nuevas y la real', case when n = 3 then 'OK' else 'FALLO: ve ' || n end);
  select count(*) into n from public.listar_codigos_alta() where estado = 'usado' and empresa_nombre like '__PRUEBA%';
  res := res || jsonb_build_object('34 admin ve qué código creó cada empresa', case when n = 2 then 'OK' else 'FALLO: ' || n end);
  -- ...y caduca la empresa 1
  perform public.establecer_suscripcion(e1, now() - interval '1 minute', false);
  execute 'reset role';

  -- ====== 9. Empresa caducada: se cierra para todos, sin borrar nada ======
  perform set_config('request.jwt.claim.sub', u_d1::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.obras;
  res := res || jsonb_build_object('35 caducada: el dueño ya no ve sus obras', case when n = 0 then 'OK' else 'FALLO: ve ' || n end);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', u_w1::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.fichajes (obra_id, trabajador_id, fecha, hora_entrada) values (o1, t1, current_date + 1, '08:00');
    res := res || jsonb_build_object('36 caducada: el trabajador ya no puede fichar', 'FALLO: fichó');
  exception when others then res := res || jsonb_build_object('36 caducada: el trabajador ya no puede fichar', 'OK'); end;
  execute 'reset role';
  res := res || jsonb_build_object('37 caducada: los datos siguen guardados',
    case when (select count(*) from public.gastos where obra_id = o1) = 1 then 'OK' else 'FALLO' end);

  -- ====== 10. Sin sesión (anon) ======
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
  select count(*) into n from public.obras;
  res := res || jsonb_build_object('38 sin sesión no se ve nada', case when n = 0 and (select count(*) from public.empresas) = 0 and (select count(*) from public.miembros) = 0 then 'OK' else 'FALLO' end);
  select tipo into m from public.comprobar_codigo_registro(cod_e1);
  res := res || jsonb_build_object('39 comprobar un código solo dice de qué tipo es', case when m = 'empresa' then 'OK' else 'FALLO: ' || coalesce(m, 'null') end);
  for n in 1..400 loop
    perform public.registrar_error('navegador', 'inundación ' || n);
  end loop;
  execute 'reset role';
  select count(*) into n from public.errores_app where mensaje like 'inundación%';
  res := res || jsonb_build_object('40 inundar el registro de errores se corta a 300 por hora', case when n between 250 and 300 then 'OK (' || n || ')' else 'FALLO: ' || n end);

  -- ====== 11. La empresa real sigue exactamente igual ======
  execute q_real into real_despues;
  res := res || jsonb_build_object('41 la empresa real no ha cambiado en nada', case when real_antes = real_despues then 'OK' else 'FALLO: ' || real_despues::text end);

  select count(*) into n from jsonb_each_text(res) where value like 'FALLO%';
  raise exception E'RESULTADO: % de % en FALLO\n%', n, (select count(*) from jsonb_object_keys(res)),
    (select string_agg(key || ' → ' || value, E'\n' order by key) from jsonb_each_text(res));
end $$;
