-- Prueba de que solo el dueño puede poner horas a mano.
-- Pega esto en Supabase → SQL Editor → Run DESPUÉS de migracion-horas-dueno.sql.
--
-- NO CAMBIA NADA: hace de trabajador y de dueño contra la base de datos de
-- verdad y al final lo deshace todo lanzando un error a propósito. El
-- resultado sale en el mensaje de ese error, en rojo — es lo esperado.
--
-- Qué tiene que salir:
--   1) el trabajador manda 06:00 y queda la hora del servidor, corregida=false
--   2) cambiar una entrada ya fichada: BLOQUEADO
--   3) la salida que manda (23:59) se cambia por la del servidor
--   4) darle otra vez a salida: BLOQUEADO
--   5) fichar un día que no es hoy: BLOQUEADO
--   6) el dueño pone 08:00-17:00 y se queda tal cual, corregida=true

do $$
declare
  v_trab uuid;
  v_trab_id uuid;
  v_dueno uuid;
  v_obra uuid;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_ahora text := to_char(now() at time zone 'Europe/Madrid', 'HH24:MI');
  v_id uuid;
  v_e text;
  v_s text;
  v_c boolean;
  r text := '';
begin
  select user_id, trabajador_id into v_trab, v_trab_id
    from public.miembros
   where rol = 'trabajador' and aprobado
   order by (trabajador_id is not null) desc
   limit 1;
  if v_trab is null then
    raise exception 'No hay ninguna cuenta de trabajador aprobada para probar';
  end if;

  -- Si esa cuenta no está enlazada con ninguna ficha, se enlaza a la primera
  -- que haya SOLO para la prueba (se deshace al final como todo lo demás).
  if v_trab_id is null then
    select id into v_trab_id from public.trabajadores order by created_at limit 1;
    update public.miembros set trabajador_id = v_trab_id where user_id = v_trab;
  end if;

  select user_id into v_dueno from public.miembros where rol = 'dueno' and aprobado limit 1;

  -- Mejor en la obra de pruebas; si no existe, en cualquiera (se deshace igual)
  select id into v_obra from public.obras where nombre = 'Obra de Prueba' limit 1;
  if v_obra is null then
    select id into v_obra from public.obras limit 1;
  end if;

  delete from public.fichajes
   where obra_id = v_obra and trabajador_id = v_trab_id and fecha in (v_hoy, v_hoy - 1);

  -- ============ Haciendo de TRABAJADOR ============
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_trab, 'role', 'authenticated')::text, true);

  insert into public.fichajes (obra_id, trabajador_id, fecha, hora_entrada, hora_corregida)
  values (v_obra, v_trab_id, v_hoy, '06:00', true)
  returning id, hora_entrada, hora_corregida into v_id, v_e, v_c;
  r := r || format(E'\n1) manda 06:00 → queda %s (servidor %s), corregida=%s', v_e, v_ahora, v_c);

  begin
    update public.fichajes set hora_entrada = '05:00' where id = v_id;
    r := r || E'\n2) cambiar la entrada: PERMITIDO  ← MAL';
  exception when others then
    r := r || E'\n2) cambiar la entrada: BLOQUEADO (' || sqlerrm || ')';
  end;

  update public.fichajes set hora_salida = '23:59' where id = v_id returning hora_salida into v_s;
  r := r || format(E'\n3) salida manda 23:59 → queda %s', v_s);

  begin
    update public.fichajes set hora_salida = '23:30' where id = v_id;
    r := r || E'\n4) segunda salida: PERMITIDA  ← MAL';
  exception when others then
    r := r || E'\n4) segunda salida: BLOQUEADA (' || sqlerrm || ')';
  end;

  begin
    insert into public.fichajes (obra_id, trabajador_id, fecha, hora_entrada)
    values (v_obra, v_trab_id, v_hoy - 1, '08:00');
    r := r || E'\n5) fichar ayer: PERMITIDO  ← MAL';
  exception when others then
    r := r || E'\n5) fichar ayer: BLOQUEADO (' || sqlerrm || ')';
  end;

  -- ============ Haciendo de DUEÑO ============
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_dueno, 'role', 'authenticated')::text, true);

  update public.fichajes
     set hora_entrada = '08:00', hora_salida = '17:00', hora_corregida = true
   where id = v_id
  returning hora_entrada, hora_salida, hora_corregida into v_e, v_s, v_c;
  r := r || format(E'\n6) dueño pone 08:00-17:00 → queda %s-%s, corregida=%s', v_e, v_s, v_c);

  perform set_config('role', 'none', true);

  -- Se deshace TODO: era solo una prueba.
  raise exception 'PRUEBA TERMINADA (no se ha guardado nada):%', r;
end $$;
