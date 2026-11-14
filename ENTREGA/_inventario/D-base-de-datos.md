# D - Database inventory (Control de Obra, v1 Supabase)

Source: `_ref-v1/supabase/schema.sql` (2171 lines, idempotent, includes all migrations; I verified every function in `migracion-*.sql` also exists in schema.sql). Line numbers `Lnnn` refer to that file. Where a function is defined several times, the LAST definition wins (noted).
Error strings are quoted exactly (Spanish, accents and punctuation as in SQL).

Conventions: "auth" = `auth.uid()`. "company" = `empresa_id`. `rol` = result of `mi_rol()`.

---

## 1. Tables (20)

PK = primary key. All `id` columns are `uuid default gen_random_uuid()` unless noted. `created_at timestamptz not null default now()` is on most tables (listed as `created_at`).

### 1.1 Core company

**empresas** (L549-570, L1571-1572) - PK id
| col | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| nombre | text | no | - |
| created_at | timestamptz | no | now() |
| codigo | text | no | `substr(replace(gen_random_uuid()::text,'-',''),1,8)` (8 lowercase hex chars), UNIQUE (`empresas_codigo_key`) |
| activa_hasta | timestamptz | yes | null (null = never expires) |
| bloqueada | boolean | no | false |

**miembros** (L323-332, L596, L1133-1134, L1415) - PK user_id; one row per account => one company per account
| col | type | null | default |
|---|---|---|---|
| user_id | uuid | no | FK auth.users ON DELETE CASCADE |
| email | text | no | - |
| nombre | text | yes | - |
| rol | text | no | 'trabajador'; CHECK in ('dueno','manager','jefe_obra','trabajador') |
| obra_id | uuid | yes | FK obras ON DELETE SET NULL (site lead's obra) |
| trabajador_id | uuid | yes | FK trabajadores ON DELETE SET NULL (worker card link) |
| aprobado | boolean | no | false |
| created_at | timestamptz | no | now() |
| empresa_id | uuid | no | `empresa_por_defecto()` (= OLDEST company), FK empresas (no ON DELETE = NO ACTION) |
| aviso_control_leido_en | timestamptz | yes | - |
| aviso_control_version | text | yes | - |
| es_soporte | boolean | no | false |
Index miembros_empresa_idx(empresa_id).

**ajustes** (L305-309, L595, L746, L2075-2079) - PK owner_id (so one row per OWNER ACCOUNT, not per company)
| col | type | null | default |
|---|---|---|---|
| owner_id | uuid | no | FK auth.users ON DELETE RESTRICT (L768-796) |
| jornada_horas | numeric(4,2) | no | 8 |
| updated_at | timestamptz | no | now() |
| empresa_id | uuid | no | `mi_empresa_id()` FK empresas |
| jefe_ve_todas | boolean | no | false |
| mod_vehiculos, mod_notas_voz, mod_caja_jefe, mod_transporte, mod_geolocalizacion | boolean | no | true each |
NO row is ever created by schema/trigger (`crear_miembro` does not create one; no `insert into ajustes` anywhere). The client must tolerate a missing row (= defaults above) and upsert it.

**soporte_accesos** (L1417-1427) - PK id
cols: empresa_id uuid not null FK empresas; otorgado_a uuid not null FK auth.users; email text not null; otorgado_por uuid not null FK auth.users; otorgado_en timestamptz not null now(); expira_en timestamptz not null; revocado_en timestamptz null; revocado_por uuid null FK auth.users. (No ON DELETE => NO ACTION.)

**admins_plataforma** (L1504-1506) - PK user_id uuid FK auth.users. RLS on, NO policies (only reachable via SECURITY DEFINER functions).

**codigos_alta** (L1574-1584, L1867-1874) - PK id; RLS on, NO policies
| col | type | null | default |
|---|---|---|---|
| codigo | text | no | UNIQUE. Format `XXXX-XXXX-XXXX` |
| nota | text | yes | |
| creado_por | uuid | yes | FK auth.users ON DELETE SET NULL |
| creado_en | timestamptz | no | now() |
| cancelado_en | timestamptz | yes | |
| usado_en | timestamptz | yes | |
| usado_por | uuid | yes | FK auth.users ON DELETE SET NULL |
| empresa_id | uuid | yes | FK empresas ON DELETE SET NULL |
| email | text | yes | |
| stripe_session_id | text | yes | UNIQUE |
| stripe_customer_id, stripe_subscription_id | text | yes | index on stripe_subscription_id |
| pagado_hasta | timestamptz | yes | |

**errores_app** (L2097-2108) - PK id `bigint generated always as identity`; creado_en timestamptz not null now(); origen text not null ('navegador'|'servidor'); mensaje text not null; detalle, ruta, navegador text null; user_id uuid null; empresa_id uuid null (no FKs). Index creado_idx(creado_en desc). RLS on, NO policies.

### 1.2 Business tables

**obras** (L11-18, L590, L1113-1118) - PK id
owner_id uuid not null FK auth.users **RESTRICT** (no default - client supplies); nombre text not null; direccion text null; activa boolean not null true; created_at; empresa_id uuid not null default `mi_empresa_id()` FK empresas; lat double precision null; lng double precision null; radio_metros integer not null 150; hora_inicio_turno text null CHECK (null or `^([01][0-9]|2[0-3]):[0-5][0-9]$`) (`obras_hora_inicio_turno_check`); minutos_antes_permitidos integer not null 30. Index obras_empresa_idx.

**trabajadores** (L20-26, L591) - id; owner_id uuid not null FK auth.users RESTRICT (no default); nombre text not null; activo boolean not null true; created_at; empresa_id not null default mi_empresa_id().

**vehiculos** (L28-34, L592) - same shape as trabajadores (nombre, activo, owner_id RESTRICT, empresa_id).

**fichajes** (L36-46, L50-65, L999-1000, L1128-1130) - PK id
| col | type | null | default |
|---|---|---|---|
| obra_id | uuid | no | FK obras **RESTRICT** (L296) |
| trabajador_id | uuid | no | FK trabajadores **RESTRICT** |
| fecha | date | no | |
| hora_entrada, hora_salida | text ('HH:MM') | yes | |
| ubicacion | text | yes | (zone/task free text) |
| created_at | timestamptz | no | now() |
| transporte | text | yes | CHECK null or in ('propio','traido') |
| traido_por | text | yes | free text |
| hora_corregida | boolean | no | false |
| confirmado_trabajador | boolean | no | **true** |
| ubicacion_ok | boolean | yes | |
| distancia_metros | integer | yes | |
UNIQUE (obra_id, trabajador_id, fecha) (L45) = one fichaje per obra+worker+day. No check exit>entry, no ghost-row check in DB.

**fichajes_historial** (L1002-1023) - PK id; fichaje_id uuid not null FK fichajes RESTRICT; obra_id not null FK obras RESTRICT; trabajador_id not null FK trabajadores RESTRICT; fecha date not null; hora_entrada_antes/hora_salida_antes/hora_entrada_despues/hora_salida_despues text null; cambiado_por uuid null FK auth.users SET NULL; cambiado_en timestamptz not null now(); obra_id_antes uuid null FK obras (NO ACTION); obra_id_despues uuid null FK obras (NO ACTION). Index (fichaje_id, cambiado_en desc).

**usos_vehiculo** (L67-102) - id; obra_id not null FK obras RESTRICT; vehiculo_id not null FK vehiculos RESTRICT; fecha date not null; km_inicio, km_fin integer null (legacy, unused); destino text null; conductor_id uuid null FK trabajadores ON DELETE SET NULL; created_at. UNIQUE (vehiculo_id, fecha, obra_id) (`usos_vehiculo_vehiculo_fecha_obra_key`) = one entry per vehicle+day+obra (the old vehicle+day unique is dropped).

**gastos** (L104-114, L130-176, L2) - id; obra_id not null FK obras RESTRICT; importe numeric(12,2) not null (NO >0 check); concepto text NULLABLE (L160); categoria text not null; fecha date not null; recibo_path text null; recibo_tipo text null; created_at; pagado_por text not null 'empresa' CHECK in ('empresa','personal') (`gastos_pagado_por_check`); proveedor text null; factura_origen_id uuid null UNIQUE (`gastos_factura_origen_unica`).

**facturas** (L116-126, L136) - LEGACY, app does not use it. id; obra_id RESTRICT; proveedor text; importe numeric(12,2) not null; fecha date not null; tipo_archivo, nombre_archivo text; storage_path text not null; created_at; pagado_por text not null 'empresa' CHECK. (Rows were copied into gastos with categoria 'Otros', L169-176.)

**cobros** (L179-188, L205-207) - id; obra_id not null FK obras RESTRICT; importe numeric(12,2) not null CHECK > 0 (`cobros_importe_positivo`); fecha date not null; concepto text null; archivo_path, archivo_tipo text null; created_at.

**entregas** (L193-201, L208-210, L594) - id; owner_id uuid not null FK auth.users RESTRICT (no default); importe numeric(12,2) not null CHECK > 0 (`entregas_importe_positivo`); fecha date not null; concepto text null; obra_id uuid null FK obras ON DELETE SET NULL; created_at; empresa_id not null default mi_empresa_id().

**notas_audio** (L214-222) - id; obra_id not null FK obras RESTRICT; fecha date not null; audio_path text not null; duracion_seg integer null; created_at; UNIQUE (obra_id, fecha) = one voice note per obra+day (re-record = upsert).

**tareas** (L228-256) - id; obra_id not null FK obras RESTRICT; nombre text not null; fecha_inicio date not null; fecha_fin date not null; avance integer not null 0 CHECK 0..100 (`tareas_avance_check`); orden integer not null 0; created_at; presupuesto numeric(12,2) null; CHECK fecha_fin >= fecha_inicio (`tareas_fechas_check`). Index (obra_id, orden, fecha_inicio).

**proveedores** (L512-521, L593) - id; owner_id uuid not null default `owner_empresa()` FK auth.users RESTRICT; nombre text not null; favorito boolean not null false; created_at; empresa_id not null default mi_empresa_id(). UNIQUE INDEX proveedores_owner_nombre_idx (owner_id, lower(nombre)) = case-insensitive unique name per OWNER (not per company).

### 1.3 FK/ON DELETE summary
- RESTRICT (L266-301): fichajes.obra_id/trabajador_id, usos_vehiculo.obra_id/vehiculo_id, gastos/facturas/cobros/notas_audio/tareas.obra_id; owner_id -> auth.users on obras, trabajadores, vehiculos, proveedores, entregas, ajustes (L768-796); all three FKs of fichajes_historial (fichaje_id, obra_id, trabajador_id).
- SET NULL: miembros.obra_id, miembros.trabajador_id, usos_vehiculo.conductor_id, entregas.obra_id, fichajes_historial.cambiado_por, codigos_alta.(creado_por, usado_por, empresa_id).
- CASCADE: miembros.user_id (auth.users).
- NO ACTION: all `empresa_id` FKs, soporte_accesos FKs, fichajes_historial.obra_id_antes/despues.
- Consequence for the fake: deleting an obra/worker/vehicle that has children must fail (only `eliminar_obra` deletes). The app never deletes them (closes/deactivates).

---

## 2. Helper functions (all `security definer stable`, `search_path = public` unless noted)

"valid membership" below = row in `miembros` with `user_id = auth.uid()` AND `aprobado` AND (`NOT es_soporte` OR an active `soporte_accesos` row exists with `empresa_id = m.empresa_id AND otorgado_a = m.user_id AND revocado_en IS NULL AND expira_en > now()`) AND the company is NOT `bloqueada` AND (`activa_hasta IS NULL OR activa_hasta > now()`). Final definitions L1592-1632.

| fn | returns | exact behaviour |
|---|---|---|
| `mi_rol()` (final L1592) | text | `rol` of the valid membership; **NULL** if no row, not approved, support grant expired/revoked, company blocked, or company expired. |
| `mi_empresa_id()` (final L1613) | uuid | `empresa_id` of the valid membership; NULL on the same conditions. |
| `owner_empresa()` (final L672) | uuid | `user_id` of the OLDEST approved member with `rol='dueno'` and `empresa_id = mi_empresa_id()` (may be a support account if it is the oldest dueno - rare). NULL if none. Only used as DEFAULT of proveedores.owner_id. |
| `mi_trabajador_id()` (L449) | uuid | `miembros.trabajador_id` where user_id=auth and aprobado. **No expiry/blocked check** (but every policy also requires `mi_rol()`). |
| `mi_obra_id()` (L456) | uuid | `miembros.obra_id` where user_id=auth and aprobado. No expiry check. |
| `empresa_por_defecto()` (L665) | uuid | OLDEST company (`order by created_at limit 1`). Not security definer. Default of miembros.empresa_id. |
| `puede_ver_obra(o_id)` (final L682) | boolean | obra exists with `empresa_id = mi_empresa_id()` AND CASE `mi_rol()`: dueno/manager/trabajador => true; `jefe_obra` => `o_id = mi_obra_id()` OR `coalesce((select jefe_ve_todas from ajustes where empresa_id = mi_empresa_id()), false)`; ELSE (incl. NULL role) false. |
| `puede_gestionar_obra(o_id)` (final L701) | boolean | same as above but WITHOUT 'trabajador' (dueno, manager => true; jefe_obra => own obra or jefe_ve_todas; else false). |
| `has_obra_access(o_id)` (L499) | boolean | alias = `puede_gestionar_obra(o_id)`. |
| `nombre_empresa_por_codigo(p_codigo text)` (L572) | text | `empresas.nombre` where `codigo = p_codigo` (exact, case-sensitive). Legacy; schema does not use it elsewhere. |
| `generar_codigo_alta_libre()` (L1877) | text | internal; random `XXXX-XXXX-XXXX` from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0,O,1,I) not already in codigos_alta. EXECUTE revoked from public/anon/authenticated. |

NULL-role handling: v1 uses `mi_rol() is distinct from 'dueno'` for the three owner-only checks (eliminar_obra, dar_acceso_soporte, revocar_acceso_soporte; L1381, 1444, 1481, fix noted L2171) so NULL role is rejected. In policies `mi_rol() = 'dueno'`/`in (...)` with NULL evaluate to NULL = denied. `mi_rol() is not null` is used as "any active member" (trabajadores select, ajustes leer).

---

## 3. RLS policies (RLS enabled on all tables below; permissive policies are OR'd)

Legend: GEST = `puede_gestionar_obra(obra_id)` (dueno/manager any obra of company; jefe_obra own obra or all if `jefe_ve_todas`). VER = `puede_ver_obra(obra_id)` (GEST roles + trabajador on any obra of the company). Table owner/service_role bypass RLS.

| table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| empresas (L624) | members whose own `miembros` row is approved and `id` = their `empresa_id` (**no expiry/blocked/support check, any role incl. worker; so expired companies' members can still read nombre/codigo/activa_hasta/bloqueada**) | none (denied) | none | none |
| miembros "dueno" (L824) | rol='dueno' and row.empresa_id = my company | same (with check same) | same | same |
| miembros "propio" (L829) | own row (`user_id = auth.uid()`) ALWAYS (even pending / expired company) | - | - | - |
| obras (L834, L838) | VER (`puede_ver_obra(id)`; includes inactive obras) | dueno/manager and `empresa_id = mi_empresa_id()` | same | same |
| trabajadores (L846, L851) | any active member (`mi_rol() is not null`) of same company | dueno/manager, same company | same | same |
| vehiculos (L858, L866) | dueno/manager/jefe_obra/trabajador, same company | dueno/manager | dueno/manager | dueno/manager |
| fichajes "gestores" (L873) | GEST | GEST | GEST | **GEST (managers and site leads CAN delete; UI restricts to owner)** |
| fichajes "propios select/insert/update" (L884-908) | rol='trabajador' AND `trabajador_id = mi_trabajador_id()` AND VER | same condition | same condition (using and check) | **none - worker cannot delete** (L877-881) |
| fichajes_historial (L1204, L1209) | GEST, OR (rol='trabajador' AND trabajador_id = mi_trabajador_id() AND VER) | none (only the SECURITY DEFINER trigger writes) | none | none |
| usos_vehiculo "access" (L1256) | GEST | GEST | GEST | GEST |
| usos_vehiculo "trabajador select" (L1262) | rol='trabajador' AND VER | - | - | - |
| gastos (L1266), facturas (L1270) | GEST | GEST | GEST | GEST (but trigger `proteger_pagado_por_mi` on gastos, see 4) |
| proveedores (L1275) | dueno/manager/jefe_obra, same company | same | same | same |
| cobros (L1281) | rol in (dueno,manager) AND GEST | same | same | same (site lead excluded) |
| entregas (L1289) | rol='dueno' AND empresa_id = mi_empresa_id() | same | same | same |
| tareas (L1296), notas_audio (L1301) | GEST | GEST | GEST | GEST |
| ajustes "leer" (L1319) | `mi_rol() is not null` AND empresa_id = mi_empresa_id() (any role) | - | - | - |
| ajustes "dueno" (L1323) | - | rol='dueno' AND `owner_id = auth.uid()` | same | same |
| soporte_accesos (L1432) | rol='dueno' AND empresa_id = mi_empresa_id() | none | none | none |
| admins_plataforma, codigos_alta, errores_app | none (RPC only) | none | none | none |

Policies dropped on purpose: "ajustes lectura", "ajustes owner" (L1316-1317), "fichajes access", "fichajes propios" (L871, L882).

Notes:
- A pending (unapproved) account: `mi_rol()` NULL, so sees only own `miembros` row (and the `empresas` row only if approved... it is not, so none). Matches "sees nothing".
- A worker can read ALL obras of the company (puede_ver_obra), all worker names, vehicles list, usos_vehiculo, ajustes, avance via RPC; NOT gastos/cobros/tareas/notas.
- Worker UPDATE policy lets a worker update any column of own fichaje rows (e.g. `ubicacion`, `transporte`, `traido_por`, `confirmado_trabajador`, `ubicacion_ok`, `distancia_metros`); only hours/date/obra/worker/`hora_corregida` are guarded by triggers.

### 3.1 Storage policies (L1341-1361) on `storage.objects`
Both policies are `for all` (select/insert/update/delete):
- "notas storage access": `bucket_id = 'notas' AND has_obra_access((storage.foldername(name))[1]::uuid)`, same expression for WITH CHECK.
- "facturas storage access": same with `bucket_id = 'facturas'`.
=> only dueno/manager/jefe_obra (own obra or flag) of the obra whose id is the FIRST path segment; workers have no access; a first segment that is not a UUID raises a cast error instead of a clean denial. Bucket `facturas` holds expense receipts/invoices and client-payment proofs; `notas` holds audio.

---

## 4. Triggers (6 clients-relevant + helpers)

Execution order of BEFORE triggers on `fichajes` (alphabetical): `proteger_horas_fichaje` -> `registrar_correccion_fichaje` -> `validar_hora_fichaje`; then AFTER `registrar_historial_fichaje`.

### 4.1 `on_auth_user_created` -> `crear_miembro()` (AFTER INSERT on auth.users, SECURITY DEFINER; final def L1975, trigger L384)
Reads `raw_user_meta_data`: `empresa_codigo`, `codigo_alta`, `nombre`, `apellidos`, `nombre_empresa`. Codes are normalised: remove every non `[A-Za-z0-9]`, uppercase. `v_persona = nullif(trim(nombre || ' ' || apellidos), '')`.
1. If `empresa_codigo` normalised <> '': find company with `upper(codigo) = code AND NOT bloqueada` (expiry NOT checked). None => `raise exception 'codigo_empresa_invalido'`. Else insert `miembros(user_id, email=coalesce(email,''), nombre=v_persona, rol='trabajador', aprobado=false, empresa_id)` (`on conflict (user_id) do nothing`).
2. Else if `codigo_alta` normalised <> '': atomically update `codigos_alta set usado_en=now(), usado_por=new.id where upper(replace(codigo,'-',''))=code and usado_en is null and cancelado_en is null` returning id, pagado_hasta. No row => `raise exception 'codigo_alta_invalido'`. Create `empresas(nombre = nullif(trim(nombre_empresa),'') or 'Mi empresa', activa_hasta = coalesce(pagado_hasta, now() + 14 days))`; set `codigos_alta.empresa_id`; insert member `rol='dueno', aprobado=true` with `nombre=v_persona`.
3. Else `raise exception 'codigo_requerido'` (so NO signup without a code; also blocks creating any auth user manually).
Company code branch has priority if both are given. A new company gets a random 8-hex `codigo`. No `ajustes` row, no providers are created.

### 4.2 `proteger_horas_fichaje` (BEFORE INSERT OR UPDATE on fichajes, not definer; L927-987)
`ahora` = `to_char(now() at time zone 'Europe/Madrid','HH24:MI')`; `hoy` = Madrid date.
- `auth.uid() is null` => return unchanged (SQL editor).
- `mi_rol() = 'dueno'` (includes active support accounts) => return unchanged (owner may write any hours/dates and set `hora_corregida` freely - the trigger does NOT set it; the client must send `hora_corregida=true`).
- Everyone else (manager, jefe_obra, trabajador, NULL role):
  - INSERT: `hora_corregida := false`. UPDATE: `hora_corregida := old.hora_corregida`; and if `fecha`, `obra_id` or `trabajador_id` changed => `'Solo el dueño puede cambiar un fichaje ya hecho.'`
  - Entry: if (INSERT and hora_entrada not null) or (UPDATE and hora_entrada distinct from old): if UPDATE and `old.hora_entrada` not null => `'La entrada ya está fichada. Solo el dueño puede cambiarla.'`; if `new.fecha <> hoy` => `'Solo se puede fichar el día de hoy.'`; else `new.hora_entrada := ahora` (client value ignored).
  - Exit: identical with `'La salida ya está fichada. Solo el dueño puede cambiarla.'`, same date message, `new.hora_salida := ahora`.
  - Entry is processed before exit, so if both are bad the entry message wins. An UPDATE that re-sends the same value is not an error. Exit can be stamped with no entry (no ordering check). Inserting a row with both hours null for any day is allowed.
  - Upsert note: `INSERT .. ON CONFLICT DO UPDATE` fires BEFORE INSERT first (hour replaced by server time), then BEFORE UPDATE with the replaced value vs old: if the field was already stamped, the new server time differs (or not, if same minute) => "ya está fichada" error (matches FIC-08). Same-minute re-stamp is silently a no-op.

### 4.3 `registrar_correccion_fichaje` (BEFORE INSERT OR UPDATE on fichajes, not definer; L1032-1058)
- INSERT: if `new.hora_corregida` then `confirmado_trabajador := false`.
- UPDATE: if `hora_entrada`, `hora_salida` or `obra_id` changed (IS DISTINCT FROM) => `confirmado_trabajador := false`. **Applies to ANY role, including the worker's own normal Salida stamp** (a worker's first stamp INSERT keeps default true; the later Salida UPDATE flips it to false). Updating only other columns (e.g. worker sending `confirmado_trabajador=true` = "Confirmo") is stored as sent.

### 4.4 `validar_hora_fichaje` (BEFORE INSERT OR UPDATE on fichajes, not definer; L1139-1176)
- `auth.uid() is null` or `mi_rol() = 'dueno'` => return.
- Only when `new.hora_entrada is not null` and (INSERT or entry changed): read the obra's `hora_inicio_turno` and `minutos_antes_permitidos`; if `hora_inicio_turno` not null: `v_limite = to_char((current_date + hora_inicio_turno::time) - minutos_antes_permitidos minutes, 'HH24:MI')`; if `new.hora_entrada < v_limite` (STRING comparison; `new.hora_entrada` is already the server Madrid time for non-owners) => `raise exception 'Todavía no puedes fichar: el turno empieza a las %. Puedes entrar desde las %.'` with (hora_inicio_turno, v_limite), e.g. `Todavía no puedes fichar: el turno empieza a las 08:00. Puedes entrar desde las 07:30.`
- Applies to managers/site leads stamping the crew as well (all non-owners). Does not apply to exit. No upper limit (late is fine).
- Edge (v1 bug): if start - minutes crosses midnight (e.g. 00:15 and 30 -> '23:45'), the limit is '23:45' and every normal entry is blocked.

### 4.5 `registrar_historial_fichaje` (AFTER INSERT OR UPDATE on fichajes, SECURITY DEFINER; L1060-1103)
- INSERT: only if `new.hora_corregida` -> insert history row (fichaje_id, obra_id, trabajador_id, fecha, hora_*_antes = NULL, hora_*_despues = new hours, cambiado_por = auth.uid()).
- UPDATE: if hora_entrada, hora_salida or obra_id changed -> insert history row with antes = old hours, despues = new hours, `obra_id_antes`/`obra_id_despues` = old/new obra ONLY when the obra changed (else NULL), `obra_id` = new obra, `cambiado_por = auth.uid()`, `cambiado_en = now()`. **This also writes a row for a worker's normal stamping (e.g. adding exit time), not only owner corrections.** A pure no-hours update (e.g. confirmado) writes nothing.

### 4.6 `proteger_pagado_por_mi` (BEFORE INSERT OR UPDATE OR DELETE on gastos, not definer; L1221-1252)
- `auth.uid() is null` or `mi_rol() = 'dueno'` => allowed.
- INSERT by non-owner with `pagado_por = 'personal'` => `'Solo el dueño puede apuntar gastos pagados por él.'`
- UPDATE/DELETE of a row whose `old.pagado_por = 'personal'` => `'Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.'`
- UPDATE by non-owner setting `new.pagado_por = 'personal'` (old was 'empresa') => `'Solo el dueño puede marcar un gasto como pagado por él.'`
- Not applied to `facturas` (legacy).

No other triggers exist (no updated_at triggers, no triggers on obras/ajustes).

---

## 5. RPC functions (client-callable)

Default Postgres/Supabase EXECUTE (public/anon/authenticated) unless stated. "DEFINER" = security definer. Functions where `soy_admin_plataforma()` is false: the list functions return an EMPTY set (no error); the mutating ones raise `'no autorizado'`.

| RPC | params | returns | def. | logic |
|---|---|---|---|---|
| `soy_admin_plataforma()` L1509 | - | boolean | DEFINER stable | `exists(admins_plataforma where user_id = auth.uid())`; false when anon. |
| `guardar_mi_nombre(nuevo text)` L391 | `nuevo` | void | DEFINER | if no auth => return silently. Else `insert into miembros(user_id,email,nombre,rol='trabajador',aprobado=false) values (auth, email from auth.users, nuevo,...) on conflict (user_id) do update set nombre = excluded.nombre`. Only the name changes for an existing row (no trim/validation; works for pending users and even expired companies). (If the row did not exist it would be created pending in the OLDEST company via default empresa_id - cannot normally happen.) |
| `confirmar_aviso_control(version text)` L1181 | `version` | void | DEFINER | no auth => return. Else `update miembros set aviso_control_leido_en = now(), aviso_control_version = version where user_id = auth.uid()`. No role/approval check. |
| `comprobar_codigo_registro(p_codigo text)` L1640 | `p_codigo` | `table(tipo text, nombre text)` | DEFINER stable | norm = upper(strip non-alnum(coalesce(p_codigo,''))). Empty => 0 rows. If a non-blocked company has `upper(codigo)=norm` => one row `('empresa', empresa.nombre)`. Else if a `codigos_alta` row with `upper(replace(codigo,'-',''))=norm`, `usado_en is null`, `cancelado_en is null` => one row `('alta', NULL)`. Else 0 rows (invalid). Company expiry not checked. Callable by anon. |
| `avance_obra(o_id uuid)` L722 | `o_id` | numeric | DEFINER stable | NULL if `not puede_ver_obra(o_id)`. Else `coalesce(sum((fecha_fin - fecha_inicio + 1) * avance) / nullif(sum(fecha_fin - fecha_inicio + 1),0), 0)` over the obra's tareas (day-weighted %; 0 when no tasks; unrounded numeric). |
| `eliminar_obra(p_obra_id uuid)` L1374 | `p_obra_id` | void | DEFINER | if `mi_rol() is distinct from 'dueno'` => `'Solo el dueño puede borrar una obra definitivamente.'`; if no obra with that id AND `empresa_id = mi_empresa_id()` => `'Esa obra no existe o no es de esta empresa.'`. Then: null `fichajes_historial.obra_id_antes/obra_id_despues` = obra; delete historial rows of that obra's fichajes; delete fichajes, usos_vehiculo, gastos, facturas, cobros, notas_audio, tareas of the obra; delete obra. (`entregas.obra_id` and `miembros.obra_id` go NULL via FK.) Does NOT delete Storage files (app does first; UI asks obra name + account password). Edge: a historial row whose `obra_id` = this obra but belongs to a fichaje now in another obra (fichaje moved away again) would make the delete fail with an FK error. |
| `dar_acceso_soporte(email_soporte text, horas integer default 24)` L1435 | | void | DEFINER | owner check `'Solo el dueño puede dar acceso de soporte.'`; `horas` null, <=0 or >720 => `'Las horas tienen que ser entre 1 y 720 (30 días).'`; user looked up in `auth.users` by `lower(email)`; not found => `'Esa cuenta todavía no existe: tiene que registrarse primero en la app.'`; if that user has a `miembros` row with `not es_soporte` => `'Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.'`. Then upsert `miembros(user_id,email,rol='dueno',aprobado=true,empresa_id = my company, es_soporte=true)` (on conflict sets empresa_id, rol='dueno', aprobado=true, es_soporte=true - re-granting from another company MOVES the support row) and insert `soporte_accesos(empresa_id, otorgado_a, email, otorgado_por=auth, expira_en = now()+horas hours)`. |
| `revocar_acceso_soporte(acceso_id uuid)` L1472 | | void | DEFINER | owner check `'Solo el dueño puede quitar el acceso de soporte.'`. `update soporte_accesos set revocado_en=now(), revocado_por=auth where id=acceso_id and empresa_id=my company and revocado_en is null`; if a row was updated: delete the `miembros` row of that user (`es_soporte` and same company). Unknown/other-company/already-revoked id => silent no-op. |
| `registrar_error(p_origen text, p_mensaje text, p_detalle text default null, p_ruta text default null, p_navegador text default null)` L2111 | | void | DEFINER | EXECUTE granted to anon, authenticated. If >=300 rows with `creado_en` in the last hour (GLOBAL across all users) => return silently. Else insert: origen = 'servidor' if `p_origen='servidor'` else 'navegador'; mensaje = `left(coalesce(nullif(trim(p_mensaje),''),'(sin mensaje)'),500)`; detalle `left(,4000)`; ruta `left(,300)`; navegador `left(,300)`; user_id = auth.uid() (NULL if anon); empresa_id = mi_empresa_id(). 2% of calls also delete rows older than 90 days. |
| `listar_empresas_admin()` (final L1819) | - | table(id uuid, nombre text, codigo text, created_at timestamptz, miembros_count bigint, obras_count bigint, activa_hasta timestamptz, bloqueada boolean, codigo_alta text) | DEFINER stable | admin only (else empty). All companies, `created_at desc`. miembros_count = members with `not es_soporte`; obras_count = ALL obras (incl. inactive); codigo_alta = `codigo` of the first codigos_alta row with that empresa_id (no ordering) or NULL. |
| `listar_codigos_alta()` (final L2032) | - | table(id uuid, codigo text, nota text, creado_en timestamptz, estado text, empresa_nombre text, usado_en timestamptz, email text, pagado boolean) | DEFINER stable | admin only (else empty). `estado` = 'usado' if usado_en not null, else 'cancelado' if cancelado_en not null, else 'libre'; `empresa_nombre` via left join; `pagado = stripe_session_id is not null`; `creado_en desc`. |
| `listar_errores_admin(p_limite int default 100)` L2140 | | table(id bigint, creado_en timestamptz, origen text, mensaje text, detalle text, ruta text, navegador text, email text, empresa text) | DEFINER stable | admin only (else empty). email from auth.users (left join, cast text), empresa = empresas.nombre (left join); `creado_en desc`; `limit least(greatest(p_limite,1),500)`. |
| `crear_codigo_alta(p_nota text default null)` (final L1905) | | text | DEFINER | `'no autorizado'` if not admin. Generates a free code (`XXXX-XXXX-XXXX`), inserts with `nota = nullif(trim(p_nota),'')`, `creado_por = auth.uid()`; returns the code. |
| `cancelar_codigo_alta(p_id uuid)` L1786 | | void | DEFINER | `'no autorizado'` if not admin; sets `cancelado_en = now()` where id and `usado_en is null and cancelado_en is null` (silent no-op otherwise). |
| `establecer_suscripcion(p_empresa uuid, p_activa_hasta timestamptz, p_bloqueada boolean)` L1801 | | void | DEFINER | `'no autorizado'` if not admin; `update empresas set activa_hasta = p_activa_hasta (null = no expiry), bloqueada = coalesce(p_bloqueada,false) where id = p_empresa` (no error if company missing). |
| `borrar_errores_admin()` L2158 | - | void | DEFINER | `'no autorizado'` if not admin; deletes all `errores_app`. |
| `registrar_pago_alta(p_session text, p_email text, p_customer text, p_subscription text, p_pagado_hasta timestamptz)` L1926 | | text | DEFINER, **EXECUTE revoked from public/anon/authenticated (service_role only)** | if a code with `stripe_session_id = p_session` exists return it (idempotent). Else generate code, insert `codigos_alta(codigo, nota='Pago con tarjeta', email, stripe_session_id, stripe_customer_id, stripe_subscription_id, pagado_hasta)` `on conflict (stripe_session_id) do nothing`, return the code of that session. |
| `actualizar_pago_suscripcion(p_subscription text, p_pagado_hasta timestamptz)` L1955 | | void | DEFINER, service_role only | sets `codigos_alta.pagado_hasta` for that subscription; sets `empresas.activa_hasta = p_pagado_hasta` for the company linked via `codigos_alta.empresa_id`, but only where `activa_hasta is not null` (never touches a no-expiry company; does NOT clear `bloqueada`). |
| `generar_codigo_alta_libre()` L1877 | - | text | DEFINER, revoked | internal helper (see 2). |
| `nombre_empresa_por_codigo(p_codigo text)` L572 | | text | DEFINER stable | legacy; not in the spec's RPC list. Returns company name by exact code. |

Helper functions (`mi_rol`, `mi_empresa_id`, `puede_ver_obra`, ...) are technically callable via RPC too but the app does not use them.

---

## 6. Storage buckets
(L1333-1339) `facturas` (private, public=false) and `notas` (private). No size/MIME limits set. Policies: section 3.1. Path convention `{obra_id}/{file}`.

## 7. Seeded data
- `empresas`: if no company exists at first run, inserts `'Mi empresa'` (L586-588). A fresh DB gets no seeded company in practice only if run with none; this is single-tenant bootstrap data.
- `proveedores`: seeds 'Leroy Merlin', 'Obramat', 'BigMat' with `favorito = true` for `owner_empresa()` (L523-530), plus one provider per distinct trimmed `gastos.proveedor` (L532-540). **Surprise: in a fresh DB `owner_empresa()` is NULL when the script runs (no owner yet; later definition also depends on `auth.uid()`, which is NULL in the SQL editor), so NOTHING is seeded.** The new-company flow does not create default providers. The fake should seed them for the demo company if the UI expects them.
- `ajustes`: no seed (see 1.1). Defaults: jornada_horas 8, jefe_ve_todas false, all five modules true.
- Backfill: gastos copied from legacy facturas (L169-176); empresa_id backfilled to the first company.
- No seeded admins (comment L1538): `admins_plataforma` is filled by hand.

---

## 8. Surprising points / contradictions with the spec

1. **`ajustes` has no auto-created row** and PK is `owner_id`; "ajustes dueno" requires `owner_id = auth.uid()`. A support (dueno) account cannot edit the company's settings row. If two ajustes rows ever exist for one company, `puede_*_obra` for a jefe_obra would error ("more than one row returned by a subquery", L696/L714).
2. **DB broader than UI**: managers/site leads can DELETE fichajes (L873, no DELETE trigger) and INSERT/UPDATE fichajes (hours forced to server time though); managers can update obras (location/schedule) and delete obras rows directly via "obras write" (only blocked by RESTRICT FKs when they have children); trabajadores/vehiculos writes allowed to managers (as spec says).
3. **`registrar_correccion_fichaje` flips `confirmado_trabajador := false` on ANY hour/obra change, including a worker's own normal Salida stamp** (L1045-1049), and `registrar_historial_fichaje` writes a history row for those too (L1080-1094). Spec FIC-09 describes these as owner-correction effects; UI shows "Sin confirmar" badge only when corrected (FIC-14/34), so the fake should keep the flag but UI logic must gate on `hora_corregida`.
4. **Owner-written `hora_corregida` is client-supplied** (owner returns early in `proteger_horas_fichaje`; no trigger sets it). History row on INSERT is written only if `hora_corregida` is true.
5. **Platform admin / support need an existing auth user, but `crear_miembro` forces every signup to have a code** (`codigo_requerido`) and creates a `miembros` row; so in practice the admin account also has a miembros row (spec says "belongs to no company": not enforced by DB). Support accounts must have no non-support miembros row (`'Esa cuenta ya es miembro real...'`).
6. `empresas` SELECT policy ignores subscription state (L626) so expired/blocked members can still read their company row (this is how the app can show the "expired" screen); `miembros propio` likewise.
7. `mi_trabajador_id()` / `mi_obra_id()` do not check expiry; always paired with `mi_rol()` in policies.
8. `proveedores` uniqueness is per `owner_id` (lower(nombre)), not per company.
9. `validar_hora_fichaje` midnight-wrap edge (4.4) and string comparison of 'HH:MM'.
10. Storage policy casts first path segment to uuid: non-UUID path => cast error.
11. `registrar_error` rate limit is global (300/hour for the whole platform), not per user.
12. `comprobar_codigo_registro` and `crear_miembro` accept company codes of expired (not blocked) companies; blocked companies => `codigo_empresa_invalido`.
13. Empresa code is 8 lowercase-hex; compared case-insensitively after stripping non-alphanumerics. Alta code `XXXX-XXXX-XXXX` (alphabet without 0,O,1,I); dashes optional on entry.
14. `crear_miembro` stores `nombre` from metadata `nombre`+`apellidos` for both flows; `guardar_mi_nombre` can overwrite it later.
15. Spec §1.2 says the owner-only items are "enforced by DB triggers, not only buttons": true for hours/pagado_por/eliminar_obra/support/miembros; NOT true for obra location/schedule (see 2) nor for fichaje deletion.
16. Spec says worker reads "active obras"; DB lets them read all obras of the company (active filter is UI-side).

---

## Rules the in-memory emulation must enforce

Roles: owner = `dueno` (incl. support with valid grant). "Active member" = approved + company not blocked + (activa_hasta null or future) + (support grant valid).

**Identity / signup / company**
1. Signup needs a code: `empresa_codigo` (company code, normalised upper alnum, company not blocked) => pending `trabajador` (aprobado=false) in that company, name = `nombre apellidos`; error `codigo_empresa_invalido` if not found/blocked. `codigo_alta` (unused, not cancelled; dashes ignored) => new company (`nombre_empresa` or 'Mi empresa'), `activa_hasta = pagado_hasta` of the code or now+14 days, user = approved `dueno`, code marked used (usado_en, usado_por, empresa_id) - one use only; error `codigo_alta_invalido`. No code => error `codigo_requerido`. (L1975-2029)
2. `comprobar_codigo_registro`: returns `[{tipo:'empresa', nombre}]` (company code, not blocked), `[{tipo:'alta', nombre:null}]` (free alta code), or `[]` (empty/invalid/used/cancelled). (L1640)
3. Active-membership gating: if the company is blocked or expired, or the support grant is expired/revoked, the user's role/company are NULL: every business table returns nothing and writes are denied; `miembros` own row and the `empresas` own row (if approved) stay readable. Pending accounts see only their own miembros row. (L1592-1632, L624-630)
4. One membership per account; company isolation: all reads/writes limited to own company (`empresa_id` via row or via obra).
5. `guardar_mi_nombre(nuevo)`: sets own `miembros.nombre`; `confirmar_aviso_control(version)`: sets own `aviso_control_leido_en = now()` and `aviso_control_version`. No-ops without session. (L391, L1181)
6. Only the owner can insert/update/delete `miembros` of their company (approve, role, link worker/obra); everyone sees only own row. (L824-830)
7. Role permissions per table: follow the matrix in section 3 exactly (obras/trabajadores/vehiculos write = owner+manager; proveedores = owner+manager+site lead; cobros = owner+manager; entregas = owner only; gastos/tareas/notas/usos_vehiculo = owner+manager+site lead (own obra or all if `jefe_ve_todas`); worker reads: obras (all of company), trabajadores names, vehiculos, usos_vehiculo, ajustes, own fichajes + own history; ajustes write = owner who owns the row).
8. Site lead scope: `jefe_obra` can see/manage only `miembros.obra_id` unless `ajustes.jefe_ve_todas` is true for the company. (L694-697, 712-715)
9. `avance_obra(obra)`: null if the caller cannot view the obra; else day-weighted average `sum((fin-inicio+1)*avance)/sum(fin-inicio+1)`, 0 with no tasks. Workers get this without reading tareas. (L722)

**Fichajes (hours)**
10. Unique (obra_id, trabajador_id, fecha); workers can insert/select/update only rows where `trabajador_id = own linked worker` on obras of their company; workers can never delete.
11. Non-owner writes (worker, manager, site lead): hour value is replaced by the SERVER time, Madrid timezone, `HH:MM`; client-sent value ignored. (L966, L977)
12. Non-owner stamping a field for a date other than today (Madrid) => `Solo se puede fichar el día de hoy.` (L964, L975)
13. Non-owner re-stamping an already-filled entry => `La entrada ya está fichada. Solo el dueño puede cambiarla.`; exit => `La salida ya está fichada. Solo el dueño puede cambiarla.` (re-sending the identical stored value is not an error; with upsert the new server time is compared). Entry is checked before exit. (L958-978)
14. Non-owner changing `fecha`, `obra_id` or `trabajador_id` of an existing row => `Solo el dueño puede cambiar un fichaje ya hecho.` (L951-955)
15. Non-owner: `hora_corregida` forced false on insert, preserved on update. Owner (and no-session) is unrestricted: any hours, any date, may set `hora_corregida`.
16. Shift-start rule (non-owners, only when entry is being set and obra has `hora_inicio_turno`): limit = start minus `minutos_antes_permitidos` (default 30), compared as 'HH:MM' strings to the server time; if earlier => `Todavía no puedes fichar: el turno empieza a las {hora_inicio_turno}. Puedes entrar desde las {limite}.` Exit is not restricted. (L1163-1164)
17. `confirmado_trabajador` (default true): on INSERT with `hora_corregida=true` => false; on UPDATE where entry, exit or obra changed (by anyone) => false; otherwise value as sent (worker "Confirmo" sets true).
18. History: AFTER insert with `hora_corregida=true` writes a row (antes = null, despues = hours, cambiado_por = user). AFTER update where entry/exit/obra changed writes a row (antes/despues hours; `obra_id_antes`/`obra_id_despues` only if obra changed; `obra_id` = new obra; `cambiado_por`, `cambiado_en`). Readable by managers of the obra and the worker's own rows; never writable by clients. (L1060-1103)
19. Managers/site leads can technically delete or edit fichajes via DB, but the UI offers corrections/deletion to owner only; the fake should keep the UI owner-only.
20. `transporte` must be null, 'propio' or 'traido'; `traido_por` free text; geofence fields `ubicacion_ok`, `distancia_metros` are plain client-written values.

**Gastos / dinero**
21. `gastos.pagado_por` in ('empresa','personal'); non-owner inserting 'personal' => `Solo el dueño puede apuntar gastos pagados por él.`; non-owner updating/deleting a row with `pagado_por='personal'` => `Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.`; non-owner changing a row to 'personal' => `Solo el dueño puede marcar un gasto como pagado por él.` (L1231-1243)
22. `cobros.importe > 0`, `entregas.importe > 0` (check violations); `tareas.avance` 0..100 and `fecha_fin >= fecha_inicio`; `obras.hora_inicio_turno` null or `HH:MM` 00:00-23:59.
23. Uniqueness: `usos_vehiculo` (vehiculo, fecha, obra); `notas_audio` (obra, fecha); `proveedores` (owner, lower(nombre)); `empresas.codigo`; `gastos.factura_origen_id`.
24. Referential protection: cannot delete an obra/trabajador/vehiculo that has fichajes, gastos, cobros, tareas, notas, usos, etc.; the app only closes/deactivates. `entregas.obra_id`, `miembros.obra_id/trabajador_id`, `usos_vehiculo.conductor_id` become null when the parent is removed.

**Owner-only operations**
25. `eliminar_obra(id)`: not owner => `Solo el dueño puede borrar una obra definitivamente.`; obra not in the caller's company/not found => `Esa obra no existe o no es de esta empresa.`; otherwise deletes fichajes (+ their history), usos_vehiculo, gastos, facturas, cobros, notas_audio, tareas, then the obra; nulls `entregas.obra_id`/`miembros.obra_id`.
26. `dar_acceso_soporte(email, horas=24)`: not owner => `Solo el dueño puede dar acceso de soporte.`; horas null/<=0/>720 => `Las horas tienen que ser entre 1 y 720 (30 días).`; unknown email => `Esa cuenta todavía no existe: tiene que registrarse primero en la app.`; account already a real member => `Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.`; else creates/updates support member (rol dueno, approved, es_soporte) in the owner's company and a `soporte_accesos` row expiring in `horas` hours. Support has owner powers while the grant is valid.
27. `revocar_acceso_soporte(id)`: not owner => `Solo el dueño puede quitar el acceso de soporte.`; marks revoked and deletes the support member row; unknown/already revoked => nothing. `soporte_accesos` is readable only by the company owner.

**Platform admin**
28. Admin = account in `admins_plataforma`. List RPCs (`listar_empresas_admin`, `listar_codigos_alta`, `listar_errores_admin`) return empty for non-admins; mutators (`crear_codigo_alta`, `cancelar_codigo_alta`, `establecer_suscripcion`, `borrar_errores_admin`) raise `no autorizado`. Code format `XXXX-XXXX-XXXX`; `cancelar` only affects unused, uncancelled codes; `establecer_suscripcion(empresa, activa_hasta|null, bloqueada|null->false)`.
29. `listar_empresas_admin` columns: id, nombre, codigo, created_at, miembros_count (excluding support), obras_count (all obras), activa_hasta, bloqueada, codigo_alta; newest first. `listar_codigos_alta` columns: id, codigo, nota, creado_en, estado ('libre'|'usado'|'cancelado'), empresa_nombre, usado_en, email, pagado. `listar_errores_admin(limite)` clamps 1..500, newest first.
30. `registrar_error`: callable without session; silently dropped if 300+ errors in the last hour; origin forced to 'servidor' or 'navegador'; message trimmed, empty => `(sin mensaje)`, truncated to 500 (detalle 4000, ruta 300, navegador 300); stores user and company when known.
31. Billing RPCs (server only): `registrar_pago_alta` idempotent per Stripe session; `actualizar_pago_suscripcion` moves `activa_hasta` only for companies that already have an expiry.

**Storage**
32. Buckets `facturas` and `notas` are private; only owner/manager/site lead (per rule 8) of the obra whose id is the first path segment may read/write/delete objects; workers cannot. Non-UUID first segment => error.

**Defaults**
33. A company without an `ajustes` row behaves as: `jornada_horas` 8, `jefe_ve_todas` false, all five modules ON. New company has no default providers in v1 (only the one-off seed script, which in practice seeded nothing).
