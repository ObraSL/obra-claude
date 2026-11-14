-- Prueba de migracion-gastos-vehiculos.sql. Pegar en Supabase → SQL Editor → Run
-- DESPUÉS de la migración.
--
-- NO CAMBIA NADA: hace de manager y de dueño contra la base de datos de
-- verdad y al final lo deshace todo lanzando un error a propósito. El
-- resultado sale en el mensaje de ese error, en rojo — es lo esperado.
--
-- Para hacer de manager crea un usuario de prueba SOLO dentro de la prueba
-- (se deshace con todo lo demás).
--
-- Qué tiene que salir:
--   1) manager apunta un gasto de la empresa, sin nota: PERMITIDO
--   2) manager apunta un gasto "pagado por mí": BLOQUEADO
--   3) manager cambia un gasto de la empresa a "pagado por mí": BLOQUEADO
--   4) manager cambia la cantidad de un gasto que pagó el dueño: BLOQUEADO
--   5) manager borra un gasto que pagó el dueño: BLOQUEADO
--   6) dueño cambia su gasto de "pagado por mí" a "la empresa": PERMITIDO
--   7) un coche en dos obras el mismo día: PERMITIDO
--   8) el mismo coche dos veces en la misma obra el mismo día: BLOQUEADO
--   9) proveedores favoritos: Leroy Merlin, Obramat, BigMat

do $$
declare
  v_otro uuid;
  v_dueno uuid;
  v_obra1 uuid;
  v_obra2 uuid;
  v_coche uuid;
  v_emp uuid;
  v_mio uuid;
  v_txt text;
  v_n int;
  r text := '';
begin
  select user_id into v_dueno from public.miembros where rol = 'dueno' and aprobado limit 1;
  -- Usuario de prueba que hace de manager: desaparece con el resto al
  -- deshacerse todo al final (comprobado el 19/09/2026: no queda rastro)
  insert into auth.users (id, email, aud, role)
  values (gen_random_uuid(), 'prueba-manager@prueba.invalid', 'authenticated', 'authenticated')
  returning id into v_otro;
  insert into public.miembros (user_id, email, rol, aprobado)
  values (v_otro, 'prueba-manager@prueba.invalid', 'manager', true)
  on conflict (user_id) do update set rol = 'manager', aprobado = true, obra_id = null;

  select id into v_obra1 from public.obras order by created_at limit 1;
  select id into v_obra2 from public.obras where id <> v_obra1 order by created_at limit 1;

  select id into v_coche from public.vehiculos order by created_at limit 1;
  if v_coche is null then
    insert into public.vehiculos (owner_id, nombre) values (v_dueno, 'Coche de prueba') returning id into v_coche;
  end if;

  -- Un gasto del dueño, pagado por él, creado como dueño
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);
  insert into public.gastos (obra_id, importe, categoria, fecha, pagado_por)
  values (v_obra1, 50, 'Material', current_date, 'personal') returning id into v_mio;

  -- ============ Haciendo de MANAGER ============
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);

  insert into public.gastos (obra_id, importe, categoria, fecha, pagado_por)
  values (v_obra1, 20, 'Material', current_date, 'empresa') returning id into v_emp;
  r := r || ' ## 1) manager, gasto de la empresa sin nota: PERMITIDO';

  begin
    insert into public.gastos (obra_id, importe, categoria, fecha, pagado_por)
    values (v_obra1, 30, 'Material', current_date, 'personal');
    r := r || ' ## 2) manager, "pagado por mí": PERMITIDO  <- MAL';
  exception when others then
    r := r || ' ## 2) manager, "pagado por mí": BLOQUEADO (' || sqlerrm || ')';
  end;

  begin
    update public.gastos set pagado_por = 'personal' where id = v_emp;
    r := r || ' ## 3) manager pasa uno a "pagado por mí": PERMITIDO  <- MAL';
  exception when others then
    r := r || ' ## 3) manager pasa uno a "pagado por mí": BLOQUEADO (' || sqlerrm || ')';
  end;

  begin
    update public.gastos set importe = 999 where id = v_mio;
    get diagnostics v_n = row_count;
    r := r || format(' ## 4) manager cambia el del dueño: %s', case when v_n = 0 then 'NO LO VE (tampoco pasa)' else 'PERMITIDO  <- MAL' end);
  exception when others then
    r := r || ' ## 4) manager cambia el del dueño: BLOQUEADO (' || sqlerrm || ')';
  end;

  begin
    delete from public.gastos where id = v_mio;
    get diagnostics v_n = row_count;
    r := r || format(' ## 5) manager borra el del dueño: %s', case when v_n = 0 then 'NO LO VE (tampoco pasa)' else 'PERMITIDO  <- MAL' end);
  exception when others then
    r := r || ' ## 5) manager borra el del dueño: BLOQUEADO (' || sqlerrm || ')';
  end;

  -- ============ Haciendo de DUEÑO ============
  perform set_config('request.jwt.claims', json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);
  update public.gastos set pagado_por = 'empresa' where id = v_mio returning pagado_por into v_txt;
  r := r || ' ## 6) dueño lo pasa a la empresa: queda ' || v_txt;

  -- ============ Coches ============
  delete from public.usos_vehiculo where vehiculo_id = v_coche and fecha = current_date;
  insert into public.usos_vehiculo (obra_id, vehiculo_id, fecha) values (v_obra1, v_coche, current_date);
  if v_obra2 is not null then
    insert into public.usos_vehiculo (obra_id, vehiculo_id, fecha) values (v_obra2, v_coche, current_date);
    r := r || ' ## 7) coche en dos obras el mismo día: PERMITIDO';
  else
    r := r || ' ## 7) (solo hay una obra: no se puede probar)';
  end if;

  begin
    insert into public.usos_vehiculo (obra_id, vehiculo_id, fecha) values (v_obra1, v_coche, current_date);
    r := r || ' ## 8) dos veces la misma obra y día: PERMITIDO  <- MAL';
  exception when others then
    r := r || ' ## 8) dos veces la misma obra y día: BLOQUEADO';
  end;

  select string_agg(nombre, ', ' order by nombre) into v_txt from public.proveedores where favorito;
  r := r || ' ## 9) favoritos: ' || coalesce(v_txt, 'NINGUNO  <- MAL');

  perform set_config('role', 'none', true);
  raise exception 'PRUEBA TERMINADA (no se ha guardado nada):%', r;
end $$;
