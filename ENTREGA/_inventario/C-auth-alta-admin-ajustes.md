# Inventory C: auth, alta (billing), admin, settings, gate screens, i18n, error logging

Source: `_ref-v1/` (v1 code) vs `_pack/ESPECIFICACION-ESTRUCTURA.md` (spec). Read-only. Line numbers are file-local (`file:line`). The code wins. Strings are quoted exactly (they are i18n keys).
Out-of-scope helpers that this area calls are named where relevant (`useMiembro`, `useObra`, `useSession`, `lib/geo.ts`, `lib/modulos.ts`); I peeked at them only to name the underlying call (marked "out of scope").

Roles: `Rol = "dueno" | "manager" | "jefe_obra" | "trabajador"` (types.ts:2). In `useMiembro` (out of scope): `rol = miembro?.aprobado ? miembro.rol : null`, `esDueno = rol==="dueno"`, `esTrabajador = rol==="trabajador"`, `gestiona = dueno|manager|jefe_obra`.

---
## 0. Index of what is covered

| # | File | Kind | Spec IDs |
|---|---|---|---|
| 1 | app/login/page.tsx | screen | ACC-02, 03, 04, 05, 13 |
| 2 | app/reset-password/page.tsx | screen | ACC-06 |
| 3 | app/alta/page.tsx | screen | ONB-01, ACC-13 |
| 4 | app/alta/ok/page.tsx | screen | ONB-02 |
| 5 | app/api/alta/checkout/route.ts (GET, POST) | API | ONB-01, ONB-04 |
| 6 | app/api/alta/codigo/route.ts (GET) | API | ONB-02 |
| 7 | app/api/stripe/webhook/route.ts (POST) | API | ONB-03 |
| 8 | lib/pagos.ts | server module | ONB-03, ONB-04 |
| 9 | app/admin/layout.tsx | layout/guard | §15 guard, ACC-14 |
| 10 | app/admin/page.tsx | screen | ADM-01..04 |
| 11 | app/(dashboard)/ajustes/page.tsx (AjustesPage, AjustesGestor, AjustesTrabajador, SectionTitle, AddInline) | screen | AJU-01, 04, 05, 06, 07, 09, W1, ACC-13/14 |
| 12 | components/ajustes/Accesos.tsx (Accesos, FilaMiembro, DetalleMiembro, Bloque, Opcion) | component | AJU-02 |
| 13 | components/ajustes/SoporteAcceso.tsx | component | AJU-03 |
| 14 | components/ajustes/ConfigurarObra.tsx | component | AJU-07 |
| 15 | components/ajustes/EliminarObra.tsx + lib/eliminar-obra.ts | component + module | AJU-08 |
| 16 | components/layout/PendienteAprobacion.tsx | gate screen | ACC-09 |
| 17 | components/layout/SuscripcionInactiva.tsx | gate screen | ACC-10 |
| 18 | components/layout/AvisoControl.tsx | gate screen | ACC-11 |
| 19 | components/ui/SelectorIdioma.tsx | component | ACC-13, PLT-01 |
| 20 | components/ui/Logo.tsx | component | Q-05 |
| 21 | lib/i18n/index.ts, lib/i18n/provider.tsx | modules | PLT-01 |
| 22 | lib/errores.ts, instrumentation.ts, instrumentation-client.ts | modules | PLT-03 |
| 23 | lib/types.ts (ROLES, AVISO_CONTROL_VERSION + Miembro, EmpresaAdmin, ErrorApp, CodigoAlta, SoporteAcceso, Obra, Trabajador, Vehiculo) | types | AJU/ADM/ACC-11 |

Count: 11 screens/gate screens (login, reset, alta, alta/ok, admin layout, admin page, ajustes gestor, ajustes worker, PendienteAprobacion, SuscripcionInactiva, AvisoControl); 4 API handlers in 3 route files; 4 ajustes components (+ inline helpers); 2 UI components; 2 i18n modules; 3 error-logging modules; 2 server/util modules (pagos, eliminar-obra); types.

---
## 1. `/login` — app/login/page.tsx (ACC-02..05, 13)

**Wrapper**: `<Suspense fallback={null}>` because of `useSearchParams`. Back arrow `Link href="/"` aria-label `"Volver"` (top-left; comment :161-162: in the installed app there is no browser bar, without it you cannot return to the start screen). `SelectorIdioma` top-right. Logo size 48 + title `"Control de Obra"`.

**Who sees what**: anonymous only (proxy redirects signed-in users away; out of scope). `modo: "login"|"signup"|"recuperar"`; initial `"signup"` if `?empresa=` or `?alta=` present (`params.get("empresa") ?? params.get("alta")` :34, `empresa` wins), else `"login"`. `codigo` state initial = that param.
- Fields per mode: Email (all modes; `autoFocus`, `type=email`, `required`, ph `"tú@ejemplo.com"`, label `"Email"`); signup adds `"Nombre"` (ph `"Ej. Ana"`) and `"Apellidos"` (ph `"Ej. Pérez López"`), both `required`; Password (`"Contraseña"`, `minLength=6`, `required`, ph `"••••••••"`, `id="login-password"`) in login+signup (hidden in recover); signup adds `"Código"` (required, `autoCapitalize="characters"`, `autoComplete="off"`, ph `"El código que te ha dado tu empresa"`; the value is NOT uppercased in state).
- Code feedback (signup only):
  - estado not in {empresa, alta} (so vacio, comprobando and invalido) -> link to `/alta`: `"¿Tu empresa aún no tiene código? Consíguelo aquí"`.
  - `comprobando` -> `"Comprobando el código…"` (grey).
  - `invalido` -> red box `"Ese código no vale (o ya se usó). Pídelo de nuevo."`.
  - `empresa` -> yellow box `tr("Te unes a la empresa «{empresa}». Su responsable tendrá que aprobarte.", {empresa: nombre})`.
  - `alta` -> yellow box `"Código válido: vas a crear tu propia empresa (14 días de prueba)."` + extra required field `"Nombre de tu empresa"` (ph `"Ej. Reformas Pérez"`).
- Submit button: login `"Entrar"`, signup `"Crear cuenta"`, recover `"Enviar enlace"`; spinner when `cargando`. `disabled = cargando || (modo==="signup" && estado not in {empresa, alta})`.
- Secondary buttons: login mode only `"¿Olvidaste tu contraseña?"` (-> recuperar); toggle: login `"¿No tienes cuenta? Créala"` (-> signup), signup `"¿Ya tienes cuenta? Inicia sesión"` and recover `"Volver a iniciar sesión"` (-> login). `cambiarModo` clears `error` and `aviso` only (code, e-mail, password kept).

**Data reads / auth calls**
| When | Call |
|---|---|
| `codigo` changes (effect :54-75). Empty after trim -> `vacio`. Else `comprobando` and after **400 ms** debounce (cancel flag + clearTimeout on change) | `supabase.rpc("comprobar_codigo_registro", { p_codigo: codigo.trim() })`. UI reads `data` as array `{tipo: string; nombre: string\|null}[]`, uses the **first row**: `tipo==="empresa"` -> `{estado:"empresa", nombre: fila.nombre ?? ""}`; `tipo==="alta"` -> `{estado:"alta"}`; anything else (no row, other tipo, error -> data null) -> `invalido`. Error ignored; no `.catch`. |
| mount (:79-86) | `localStorage.getItem("control-de-obra:email")`; if present -> `setEmail`, then `requestAnimationFrame(() => document.getElementById("login-password")?.focus())` |
| submit, login | `supabase.auth.signInWithPassword({ email, password })` |
| submit, signup | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/login`, data } })`; `data` = if `codigoInfo.estado==="empresa"`: `{ empresa_codigo: codigo.trim(), nombre: nombre.trim(), apellidos: apellidos.trim() }`; else (alta): `{ codigo_alta: codigo.trim(), nombre_empresa: nombreEmpresa.trim(), nombre: nombre.trim(), apellidos: apellidos.trim() }` |
| submit, recover | `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })` |

**Outcomes**
- Login OK: `localStorage.setItem("control-de-obra:email", email)`, `router.push("/")`, `router.refresh()`.
- Login error mapping (exact `error.message` match): `"Invalid login credentials"` -> `tr("Contraseña incorrecta. Vuelve a escribirla.")`, `setPassword("")`, focus password, **stay on screen, e-mail kept**; `"Email not confirmed"` -> `tr("Todavía no has confirmado tu email. Busca el correo de confirmación.")`; any other -> raw `error.message` (untranslated). `cargando` reset to false.
- Error box (red, prominent; comment :267-268 "Bien visible: con el teclado del iPhone abierto, un aviso pequeño en gris pasaba desapercibido y parecía que no hacía nada"): `{error}` + if `error.startsWith("Contraseña incorrecta")` extra line `"Si sigue fallando, revisa que el email esté bien escrito."`. Typing in password clears `error`.
- Signup OK: `aviso = "Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión."`, `setModo("login")`. Signup error: raw `error.message`. The e-mail is NOT saved to localStorage on signup. Password/code stay in state.
- Recover OK: `aviso = "Si ese email tiene una cuenta, te hemos enviado un enlace para restablecer la contraseña."` (stays in recover mode). Error: raw message.
- `aviso` = green text under the form.

**Local state**: localStorage `control-de-obra:email` (read mount, write on login success). No cookie. No window events.

**Lessons in comments**: :17 focus password so it can be typed "sin tener que tocar nada más"; :52-53 debounce so it does not query "por cada letra" and the code type is shown "antes de crear la cuenta"; :77-78 only the e-mail is remembered, the password "nunca se guarda"; :104-105 wrong password keeps e-mail, only the bad password is cleared; :161-162 back arrow needed in installed PWA; :267-268 visible error because of iPhone keyboard.

**Discrepancies vs spec**
- (new) login/page.tsx:272 `error.startsWith("Contraseña incorrecta")` compares translated text with a Spanish literal: in uk/en the hint `"Si sigue fallando..."` never shows. Spec ACC-02 silent.
- (new) Raw Supabase `error.message` shown for other login/signup/recover errors (:112, :138, :150), untranslated.
- ACC-03 / ACC-02 / ACC-04 / ACC-05 match. "No signup without a code" is only enforced by the disabled button here (DB trigger is the authority; unclear). `minLength=6` also applies in login mode (HTML validation blocks submitting <6 chars).

---
## 2. `/reset-password` — app/reset-password/page.tsx (ACC-06)

- No session/role check in this file, no redirect logic (the recovery link creates the session). No `SelectorIdioma`, no back link. Title `"Nueva contraseña"`, Logo 48.
- Fields: `"Contraseña nueva"` (autoFocus) and `"Repite la contraseña"`, both `type=password required minLength=6`, ph `"••••••••"`.
- JS validation (:26-33; HTML `minLength` normally blocks <6 first): `password.length < 6` -> `"La contraseña debe tener al menos 6 caracteres."`; `password !== password2` -> `"Las dos contraseñas no coinciden."`.
- Write: `supabase.auth.updateUser({ password })`. Error: `error.message.includes("session")` -> `"El enlace ha caducado o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?»."`, else raw message. Success: `hecho=true` -> form replaced by green centered `"Contraseña actualizada. Entrando…"`; `setTimeout(1500)` -> `router.push("/")` + `router.refresh()`.
- Button `"Guardar contraseña"` (spinner while `cargando`). Error = plain red line.
- Discrepancies: none vs ACC-06. Raw message for non-session errors.

---
## 3. `/alta` — app/alta/page.tsx (ONB-01, ACC-13)

- Anonymous. Back arrow `Link href="/login"` aria `"Volver"`; `SelectorIdioma`; Logo 44; title `"Alta de empresa"`.
- **Read** on mount: `fetch("/api/alta/checkout")` (GET) -> JSON `Precio = {disponible:false} | {disponible:true, importe:number, moneda:string, intervalo:string}`; any fetch/parse failure -> `{disponible:false}`. While `null`: spinner.
- Not available: yellow box `"El alta con tarjeta todavía no está abierta. Pide tu código directamente a Control de Obra."`.
- Available: box with bold `"14 días gratis"` + `tr(intervalo==="year" ? "Después, {importe} al año. Puedes darte de baja cuando quieras. Al terminar el pago recibirás tu código para crear la empresa." : "Después, {importe} al mes. Puedes darte de baja cuando quieras. Al terminar el pago recibirás tu código para crear la empresa.", {importe})` (any intervalo other than `year` uses the month text). `importe = new Intl.NumberFormat("es-ES", {style:"currency", currency: moneda.toUpperCase()}).format(importe)` (alta/page.tsx:46-50, **hard-coded `es-ES`**).
- Form: `"Email de la empresa"` (`type=email required`, ph `"tú@empresa.com"`), button `"Pagar con tarjeta"` (spinner).
- **Write**: `fetch("/api/alta/checkout", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email})})`; `datos = await r.json().catch(()=>({}))`; if `datos.url` -> `window.location.href = datos.url` (button stays in loading); else `error = datos.error ? tr(datos.error) : tr("No se pudo abrir el pago. Inténtalo otra vez.")`, `cargando=false`. Server error strings are Spanish keys passed through `tr()` (server sends `"El pago con tarjeta todavía no está disponible."`).
- Error box: red, bold.
- Discrepancies: price formatting hard-coded `es-ES` (spec §20.3). E-mail not trimmed client-side (server trims).

---
## 4. `/alta/ok` — app/alta/ok/page.tsx (ONB-02)

- `<Suspense>`; `session_id = useSearchParams().get("session_id")`. No selector. Logo 44.
- Initial `error = sessionId ? "" : tr("Falta información del pago.")` (translated at first render).
- **Read** on mount (if sessionId): `fetch(`/api/alta/codigo?session_id=${encodeURIComponent(sessionId)}`)` -> `{codigo}` or `{error}`; `d.codigo` -> show; else `error = d.error ? tr(d.error) : tr("No se pudo comprobar el pago.")`; fetch/parse failure -> `"No se pudo comprobar el pago."`. **No polling/retry** (a 409 pending shows as error).
- Title: `error ? "Pago sin confirmar" : codigo ? "Pago recibido" : "Comprobando el pago…"`.
- Error state: red box `{error} {tr("Si el cargo aparece en tu tarjeta, escríbenos y te damos el código.")}`.
- Loading: spinner. Success: `"Este es tu código para crear la empresa. Guárdalo: sirve una sola vez."`; big monospace copy button showing the code with Copy icon -> Check icon (green) after copy (`navigator.clipboard.writeText` in try/catch, silent on failure: "se puede copiar a mano"; `copiado` never resets); link button `"Crear mi empresa"` -> `/login?alta=${encodeURIComponent(codigo)}`.
- Discrepancies: none vs ONB-02 (copied state never resets; admin page resets after 2 s).

---
## 5. API routes

### 5.1 `/api/alta/checkout` (app/api/alta/checkout/route.ts)
Env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY` (all three required by `pagosConfigurados()`).
- **GET**: no stripe or not configured -> `{disponible:false}`. Else `stripe.prices.retrieve(STRIPE_PRICE_ID)` -> `{disponible:true, importe:(unit_amount ?? 0)/100, moneda: price.currency, intervalo: price.recurring?.interval ?? "month"}`. No try/catch (a Stripe failure = 500; client falls back to `disponible:false`).
- **POST**: not configured -> `503 {error:"El pago con tarjeta todavía no está disponible."}`. Body `{email?}` (`request.json().catch(()=>({}))`). `origin = request.nextUrl.origin`. `stripe.checkout.sessions.create({ mode:"subscription", line_items:[{price: STRIPE_PRICE_ID, quantity:1}], customer_email: email?.trim() || undefined, subscription_data:{trial_period_days:14}, billing_address_collection:"required", tax_id_collection:{enabled:true}, locale:"es", success_url:`${origin}/alta/ok?session_id={CHECKOUT_SESSION_ID}`, cancel_url:`${origin}/alta` })` -> `{url: session.url}`. No try/catch.
- Spec ONB-01: matches exactly.

### 5.2 `/api/alta/codigo` (GET)
Query `session_id`. Missing stripe/config/sessionId -> `400 {error:"Falta información del pago."}`. `codigoDePago(stripe, sessionId)`; null -> `409 {error:"El pago todavía no está completado."}`; ok -> `{codigo}`; exception -> `500 {error:"No se pudo comprobar el pago."}`. Public endpoint: anyone with a valid `session_id` gets the code (idempotent per session).

### 5.3 `/api/stripe/webhook` (POST)
Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the last two via `adminDb()`); does not require `STRIPE_PRICE_ID`. No stripe or no secret -> `503 "no configurado"`. Signature: `stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret)`; failure -> `400 "firma no válida"`. Events:
- `checkout.session.completed` -> `codigoDePago(stripe, evento.data.object.id)` (errors uncaught -> 500, Stripe retries).
- `customer.subscription.created|updated|deleted` -> `adminDb().rpc("actualizar_pago_suscripcion", { p_subscription: sub.id, p_pagado_hasta: pagadoHasta(sub) })`; `error` -> `500 "error de base de datos"`.
- Others ignored. Success `{recibido:true}`. Comment: signature is mandatory, "sin ella, cualquiera podría 'avisar' de pagos falsos".

### 5.4 lib/pagos.ts (server only; comment :3-5)
- `getStripe()` = `new Stripe(STRIPE_SECRET_KEY)` or null (no apiVersion pinned).
- `adminDb()` = `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})` (bypasses RLS).
- `DIAS_MARGEN = 3` ("Días de margen tras el fin del periodo, mientras Stripe reintenta cobrar").
- `pagadoHasta(sub)`: status in `["canceled","unpaid","incomplete_expired"]` -> `new Date().toISOString()`; else `fines = sub.items.data.map(i => i.current_period_end)` (+ `sub.trial_end` if set); `fin = Math.max(...fines, Math.floor(Date.now()/1000))`; result `new Date((fin + 3*86400)*1000).toISOString()`.
- `codigoDePago(stripe, sessionId)`: `stripe.checkout.sessions.retrieve(sessionId, {expand:["subscription"]})`; `status !== "complete"` or no subscription -> `null`; else `adminDb().rpc("registrar_pago_alta", { p_session: session.id, p_email: session.customer_details?.email ?? session.customer_email ?? null, p_customer: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null, p_subscription: sub.id, p_pagado_hasta: pagadoHasta(sub) })`; `error` -> throw; returns `data as string` (the alta code; "siempre el mismo para ese pago").
- Discrepancy (minor, ONB-03): spec says "(or now if canceled/unpaid)"; code also treats `incomplete_expired` as now, and floors the end at now (so a past period still yields now + 3 d). Code wins.

---
## 6. Admin — app/admin/layout.tsx + app/admin/page.tsx

### 6.1 layout (guard)
- Uses `useSession()` (out of scope: `auth.getSession()` + `auth.onAuthStateChange`). Effect (when session finished loading): no session -> `router.replace("/login")`; else `supabase.rpc("soy_admin_plataforma")` -> `esAdmin = Boolean(data)` (error -> false).
- Render: spinner while `cargandoSesion || (session && esAdmin===null)`; `!esAdmin` -> ShieldOff icon + `"Esto no es para esta cuenta"` + GhostButton `"Cerrar sesión"` (signOut, `router.push("/login")`, refresh). With no session this screen shows briefly before the redirect to /login.
- Frame: Logo 28, title `"Admin"`, `"Salir"` button (signOut, `/login`); max width 2xl. Comment :12-18: platform admin is "una cuenta completamente aparte de cualquier empresa-cliente (ni 'dueno', ni ningún otro rol — vive solo en admins_plataforma)"; shares nothing with (dashboard): no ObraProvider/MiembroProvider/menus. No language selector.

### 6.2 page (ADM-01..04). State: `empresas, codigos, errores, abierto (error id|null), nota, creando, copiado, error, cargando`
**Reads** (mount + after every write; `cargar()` :36-46, one `Promise.all`; errors ignored, `data ?? []`):
- `supabase.rpc("listar_empresas_admin")` -> `EmpresaAdmin[]`
- `supabase.rpc("listar_codigos_alta")` -> `CodigoAlta[]`
- `supabase.rpc("listar_errores_admin", { p_limite: 100 })` -> `ErrorApp[]`

**Writes**
- `crearCodigo`: `rpc("crear_codigo_alta", { p_nota: nota })` (nota untrimmed, "" allowed). Error or falsy data -> `"No se pudo crear el código. Inténtalo otra vez."`; success: `nota=""`, auto-copy `data as string` to the clipboard (try/catch), `cargar()`.
- `cancelar(id)`: after `confirm(tr("¿Cancelar este código? Ya no se podrá usar."))` -> `rpc("cancelar_codigo_alta", { p_id: id })`; error ignored; `cargar()`.
- `ponerSuscripcion(e, hasta, bloqueada)`: `rpc("establecer_suscripcion", { p_empresa: e.id, p_activa_hasta: hasta (ISO string | null), p_bloqueada: bloqueada })`; error ignored; `cargar()`.
  - `"+1 mes"` (`renovarMes` :91-96): `hoy=new Date(); base = e.activa_hasta && new Date(e.activa_hasta) > hoy ? new Date(e.activa_hasta) : hoy; base.setMonth(base.getMonth()+1)` (client local time) -> `ponerSuscripcion(e, base.toISOString(), false)` (also unblocks).
  - `"Bloquear"`: `confirm(tr("¿Bloquear el acceso de «{empresa}»? No se borra nada.", {empresa: e.nombre}))` -> `ponerSuscripcion(e, e.activa_hasta, true)`. `"Desbloquear"` (no confirm) -> `ponerSuscripcion(e, e.activa_hasta, false)`.
- `"Vaciar la lista"`: `confirm(tr("¿Borrar todos los errores de la lista?"))` -> `rpc("borrar_errores_admin")` (no params) -> `cargar()`.
- `"Actualizar"` (GhostButton) -> `cargar()`.

**Display / exact strings**
- Header `"Todas las empresas"`; count `trN(n, "{n} empresa registrada", "{n} empresas registradas")`. Empty (`<Empty>`): title `"Todavía no hay ninguna"`, sub `"Aparecerán aquí en cuanto alguien se registre."`. Spinner while loading.
- Company card: `e.nombre`, `fecha(e.created_at)`, `e.miembros_count`, `e.obras_count`, `e.codigo` (company join code, mono); subscription phrase (`estadoSuscripcion` :16-22): `e.bloqueada` -> `"Bloqueada"` (red); `!e.activa_hasta` -> `"Sin caducidad"` (green); `dias = Math.ceil((new Date(activa_hasta).getTime() - Date.now())/86_400_000)`; `dias<=0` -> `tr("Caducada el {fecha}", {fecha})` (red); else `tr("Activa hasta {fecha} ({dias} d)", {fecha, dias})` (yellow). Next to it: `e.codigo_alta ? tr("Alta: {codigo}", {codigo}) : "Sin código de alta"`. Buttons `"+1 mes"`, then `"Desbloquear"` (if bloqueada) or `"Bloquear"`.
- Section `"Códigos para empresas nuevas"`; help `"Cada código sirve una sola vez y crea una empresa nueva con 14 días de prueba. Se copia solo al crearlo."`; input ph `"Nota (ej. para quién es) — opcional"`; button `"Crear código nuevo"`; error in red below.
- Free codes (`estado==="libre"`): code mono; sub-line `c.pagado ? `${tr("Tarjeta")} · ${c.email ?? ""} · ` : c.nota ? `${c.nota} · ` : ""` + `tr("creado {fecha}", {fecha})`; buttons `"Copiar"` / `"Copiado"` (2 s reset via `setTimeout`) and `"Cancelar"`. Empty: `"No hay códigos sin usar."`.
- Others (`estado!=="libre"`): heading `"Usados y cancelados"`; row: `c.codigo` + (`c.pagado ? tr(" · tarjeta") : ""`); right: `usado` -> `` `→ ${c.empresa_nombre ?? tr("(empresa borrada)")} · ${c.usado_en ? fecha(c.usado_en) : ""}` `` else literal `"cancelado"` (not `tr()`, :249).
- Section `"Errores de la app"`; help `"Los fallos que les salen a los usuarios, del móvil y del servidor. Se borran solos a los 90 días."`; empty `"Ningún error registrado."`; each row (click toggles expand by id): `new Date(e.creado_en).toLocaleString(localeActual())` + ` · ` + (`e.origen==="servidor"` ? `"servidor"` : `"móvil / navegador"`), right: `e.empresa ?? e.email ?? ""`; message (2-line clamp); `e.ruta` (mono) if any; expanded `<pre>`: `[e.email, e.navegador, e.detalle].filter(Boolean).join("\n\n")`.

**Discrepancies**
- `fecha()` = `new Date(iso).toLocaleDateString("es-ES")` hard-coded (admin/page.tsx:13), spec §20.3. (The error timestamp correctly uses `localeActual()` :276.)
- Literal `"cancelado"` (:249) untranslated (§20.3). `"Tarjeta"` and `" · tarjeta"` are translated.
- Native `confirm()` dialogs (3). All write errors silently ignored except `crearCodigo`.
- ADM-01..04 otherwise match; "last 100" = `p_limite: 100`.

---
## 7. Settings `/ajustes` — app/(dashboard)/ajustes/page.tsx

`AjustesPage`: `esTrabajador ? <AjustesTrabajador/> : <AjustesGestor/>` (from `useMiembro`).

### 7.1 Gestor variant: section order per role (`administra = rol==="dueno"||rol==="manager"`)
1. **Idioma** (everyone incl. site lead): `SectionTitle "Idioma"` + `SelectorIdioma`.
2. `esDueno`: **Accesos** (`<Accesos/>`), **Soporte** (`<SoporteAcceso/>`).
3. `esDueno`: **Jornada**, **Jefe de obra**, **Módulos**.
4. `administra` (owner + manager): **Obras**, **Trabajadores**, **Vehículos**.
5. Bottom logout button, `md:hidden` (mobile only): `"Cerrar sesión"` -> `signOut()`, `router.push("/login")`, `router.refresh()`.
Site lead: Idioma + logout only (matches AJU-01). Whether a support account has `rol==="dueno"` is unclear (depends on `miembros.rol` / `mi_rol()`; out of scope).

**Section titles** (`SectionTitle` = icon + uppercase text): `"Idioma"`, `"Accesos"`, `"Soporte"`, `"Jornada"`, `"Jefe de obra"`, `"Módulos"`, `"Obras"`, `"Trabajadores"`, `"Vehículos"`; worker: `"Mi cuenta"`, `"Idioma"`.

**Jornada** (owner): text `tr("Horas de una jornada normal. Lo que pase de ahí en un día cuenta como")` + bold `tr("horas extra")` + "."; `<Input type=number inputMode=decimal min=1 max=24 step="0.5">`; shows `jornadaHoras` until edited (`jornadaTexto===""`). Button `"Guardar"` disabled when `jornadaTexto===""` || `Number(jornadaTexto)===jornadaHoras` || `!(Number(jornadaTexto) > 0 && Number(jornadaTexto) <= 24)`. Click: `await guardarJornada(Number(jornadaTexto)); setJornadaTexto("")`.
- `guardarJornada` (useObra, obra-context.tsx:57-69, out of scope): `auth.getUser()`, optimistic state, then `from("ajustes").upsert({ owner_id: user.id, jornada_horas: horas, updated_at: new Date().toISOString() })`. Read (obra-context:46-55): `from("ajustes").select("jornada_horas,jefe_ve_todas").maybeSingle()`; `if (data?.jornada_horas) Number(...)`; fallback constant `JORNADA_POR_DEFECTO` (value not read; spec says 8).

**Jefe de obra** (owner): `tr("Deja que el jefe de obra vea")` + bold `tr("todas las obras")` + `tr("de la empresa, no solo la que tiene asignada.")`; pill toggle `"Activado"` / `"Desactivado"` -> `guardarJefeVeTodas(!jefeVeTodas)` = `from("ajustes").upsert({ owner_id: user.id, jefe_ve_todas: valor, updated_at })` (optimistic).

**Módulos** (owner): help `"Apaga lo que tu empresa no use: desaparece del menú y de las pantallas de todos. No se borra nada."`; one row per `LISTA_MODULOS` (lib/modulos.ts, out of scope), `tr(m.label)` / `tr(m.descripcion)` + pill `"Activado"`/`"Desactivado"` -> `guardarModulo(clave, !modulos[clave])` = `from("ajustes").upsert({ owner_id: user.id, ["mod_"+clave]: valor, updated_at })` (optimistic). Exact list (key / label / descripcion):
- `vehiculos` / "Vehículos" / "Quién lleva cada coche y a qué obra."
- `notas_voz` / "Notas de voz" / "Una nota grabada por día y obra."
- `caja_jefe` / "Dinero del jefe" / "El dinero que el jefe te da para gastos y sueldos, y lo que te queda."
- `transporte` / "Cómo llegó a la obra" / "El trabajador apunta si vino en su coche o le trajeron."
- `geolocalizacion` / "Ubicación al fichar" / "Al fichar se comprueba si el móvil está dentro o fuera de la obra."
Modules are read (miembro-context, out of scope) with `from("ajustes").select("*").limit(1).maybeSingle()` -> `mod_<clave>` booleans; missing row or field = ON.

**Obras** (owner + manager): help `"Toca una obra para verla entera (fichajes, gastos, dinero…), esté activa o cerrada."`. List from `useObra().obras` (no query here). Row (button): name, address if any; tap -> `setObraId(o.id); router.push("/")`. Inside the row (all `span role=button tabIndex=0`, Enter/Space handled, `stopPropagation`): status pill `"Activa"`/`"Cerrada"` -> `toggleObraActiva(o.id)`; **owner only** MapPin (aria `tr("Ubicación y horario de {obra}", {obra})`) -> `ConfigurarObra` sheet; **owner only** Trash2 (aria `tr("Borrar {obra} para siempre", {obra})`) -> `EliminarObra` sheet; chevron. Then `AddInline` (label `"Nueva obra"`, ph `"Nombre de la obra"`) -> `crearObra(v, "")`.
- `crearObra(nombre, direccion)` (obra-context:117-135): `auth.getUser()`; `from("obras").insert({ owner_id: user.id, nombre, direccion: direccion || null, activa: true }).select().single()`; prepends to list and makes it current. `toggleObraActiva`: `from("obras").update({ activa: !obra.activa }).eq("id", id).select().single()`. Obras read: `from("obras").select("*").order("created_at", { ascending: false })`.
- Sheets: `<Sheet title="Borrar obra">` with `EliminarObra` (`onEliminada` -> close + `await refrescar()`); `<Sheet title=tr("Ubicación y horario · {obra}", {obra})>` with `ConfigurarObra` (`onGuardado` -> close + `await refrescar()`; the argument is ignored).

**Trabajadores / Vehículos** (owner + manager):
- Reads on mount: `from("trabajadores").select("*").order("nombre")`; `from("vehiculos").select("*").order("nombre")`.
- Empty: `"Todavía no hay trabajadores."`, `"Todavía no hay vehículos."`. Rows: name + pill `"Activo"`/`"Baja"` -> toggle.
- Toggle: `from(t).update({ activo: !x.activo }).eq("id", id).select().single()`; on success replace the row; error silently ignored.
- Add (`AddInline`): `auth.getUser()` (abort if no user); `from("trabajadores"|"vehiculos").insert({ owner_id: user.id, nombre }).select().single()`; on data -> append + client sort `localeCompare`; error silent. Labels: `"Nuevo trabajador"` (ph `"Nombre"`), `"Nuevo vehículo"` (ph `"Ej. Furgoneta — 1234 ABC"`).
- No hard delete (matches AJU-09).
- `AddInline`: collapsed = dashed button with Plus + label; opened = Input autoFocus + `"Cancelar"` (resets) + `"Añadir"` (disabled when `!value.trim()`; `onAdd(value.trim())`, clears, closes).

### 7.2 Worker variant (`AjustesTrabajador`): order Mi cuenta, Idioma, logout
- `"Mi cuenta"` card: `miembro?.nombre || "—"`, `miembro?.email`, role pill `tr(ROLES.find(r => r.id === miembro?.rol)?.label ?? "")`, hint `"Si algo de esto no está bien, díselo al jefe: él lo cambia desde su cuenta."`.
- `"Idioma"` selector. Logout `"Cerrar sesión"` always visible (not md:hidden) -> signOut, `router.push("/")` (**gestor variant pushes `/login`**), refresh.
- Matches AJU-W1.

### 7.3 Discrepancies (settings page)
- Jornada: spec AJU-04 says 1–24 step 0.5; code accepts any value `>0 && <=24` (0.5 passes); `min=1` is a plain HTML attribute on a non-form input and is not enforced (ajustes/page.tsx:143-147).
- `owner_id: user.id` is sent on inserts/upserts of `trabajadores`, `vehiculos`, `obras`, `ajustes` (:61, :82; obra-context); spec PLT-06 says rows carry `empresa_id`: how `empresa_id` gets filled (DB default/trigger) is **unclear** from client code; v2 must check the schema.
- Logout redirect differs (`/login` gestor vs `/` worker, gate screens `/`), spec silent.
- All toggle/add errors silent.
- Role label untranslated in the Accesos list (see §8).

---
## 8. Accesos — components/ajustes/Accesos.tsx (AJU-02; owner only)

**State**: `miembros, trabajadores, codigoEmpresa, cargando, abierto (Miembro|null), copiado`. Uses `useMiembro().miembro` (as `yo`) and `useObra().obras`.
**Reads** (mount, one `Promise.all`, :44-54):
- `from("miembros").select("*").order("created_at", { ascending: true })`
- `from("trabajadores").select("*").order("nombre")`
- `from("empresas").select("codigo").limit(1).maybeSingle()` -> `{codigo}`
Spinner while loading.
**Display**
- Invitation card (if `codigoEmpresa`): title `"Enlace para invitar a tu equipo"`; link text `${window.location.origin}/login?empresa=${codigoEmpresa}` (code not URL-encoded); button `"Copiar enlace"` -> `"¡Copiado!"` for 2000 ms; `navigator.clipboard.writeText` has **no** try/catch.
- Pending list (`!m.aprobado`): header `tr("Esperando tu aprobación ({n})", {n})` (only if any). Rows open the sheet.
- Active list (`m.aprobado`): `esYo = m.user_id === yo?.user_id` -> shows `"(tú)"`, not clickable (no role=button, no pointer, onClick noop). Right column: `m.aprobado ? etiquetaRol(m.rol) : "Pendiente"`; under it `obras.find(o => o.id === m.obra_id)?.nombre` (any role with obra_id; active list only). Title `m.nombre || m.email`; second line e-mail if a name exists. Avatar BadgeCheck (approved) / UserPlus (pending).
- Footer hint (dashed box): `trJsx("Quien se registre con su correo aparecerá aquí como {pendiente}. Hasta que tú no le des acceso, no ve nada de las obras.", {pendiente: tr("pendiente") bold})`.
- Sheet title `abierto.nombre || abierto.email`. Content `DetalleMiembro`: e-mail line; block `"Nivel de acceso"` = 4 buttons from `ROLES` (`tr(label)` + `tr(descripcion)`, selected = yellow + check); block `"Obra que lleva"` only when `m.rol==="jefe_obra"` (options = all `obras` from context including closed; no "none" option); block `"Ficha de trabajador"` only when `m.rol==="trabajador"`: help `"Enlaza esta cuenta con su ficha para que sus horas se apunten donde toca."`, options = all `trabajadores` rows (active and inactive), plus dashed button `tr("Crear ficha «{nombre}»", {nombre})` shown when `m.nombre && !fichaExistente` (`fichaExistente = trabajadores.some(t => t.id === m.trabajador_id)`).
- Footer actions: approved -> GhostButton `"Suspender acceso"`; pending -> PrimaryButton `"Dar acceso"`; two-step delete: `"Eliminar de la lista"` -> `"Cancelar"` / `"Sí, eliminar"`.
**Role labels/descriptions** (ROLES, types.ts:4-9, exact): `dueno` "Dueño" / "Acceso total y reparte permisos"; `manager` "Manager" / "Ve y gestiona todas las obras"; `jefe_obra` "Jefe de obra" / "Gestiona solo la obra que le asignes"; `trabajador` "Trabajador" / "Solo ficha sus horas; no ve gastos ni a otros".
**Writes**
- `actualizar(userId, cambios)`: `from("miembros").update(cambios).eq("user_id", userId).select().single()`; on data replace in list and in the open sheet; **error silently ignored**.
  - role click: `{ rol: r.id, ...(r.id !== "jefe_obra" ? { obra_id: null } : {}) }` (fires even when the role is unchanged; does not clear `trabajador_id`).
  - obra click `{ obra_id: o.id }`; ficha click `{ trabajador_id: t.id }`; approve `{ aprobado: true }`; suspend `{ aprobado: false }`.
- `eliminar(userId)`: `from("miembros").delete().eq("user_id", userId)`; the list is updated optimistically **regardless of error**; sheet closed.
- `crearFicha(m)`: `auth.getUser()`; `from("trabajadores").insert({ owner_id: user.id, nombre: m.nombre }).select().single()`; on data: append + sort (`localeCompare`), then `actualizar(m.user_id, { trabajador_id: data.id })`.
**Comments**: :27-31 "Nadie puede subirse el nivel a sí mismo: cambiar roles es cosa del dueño (así está también en la base de datos)".
**Discrepancies**: (a) `etiquetaRol` (:25) returns the raw Spanish label and is rendered at :219 without `tr()`: the role in the members list is **untranslated** (not listed in spec §20). (b) Spec AJU-02 otherwise matches.

---
## 9. SoporteAcceso — components/ajustes/SoporteAcceso.tsx (AJU-03; owner only)

- Read (mount + after writes): `from("soporte_accesos").select("*").order("otorgado_en", { ascending: false })` (no limit). Row type `SoporteAcceso {id, empresa_id, otorgado_a, email, otorgado_por, otorgado_en, expira_en, revocado_en, revocado_por}`.
- Form: help `"Dale acceso temporal al desarrollador para que pueda ayudarte. Tiene que haberse registrado antes con ese correo. Pasadas las horas, se le quita solo."`; `"Correo de la cuenta de soporte"` (`type=email`, ph `"soporte@ejemplo.com"`); `"Horas de acceso"` (`type=number inputMode=numeric min=1 max=720`, initial `"24"`; HTML attrs only, not enforced). Button `"Dar acceso"` disabled when `!email.trim() || !horas || dando`.
- Write: `rpc("dar_acceso_soporte", { email_soporte: email.trim(), horas: Number(horas) })` (param names have **no `p_` prefix**). Error -> raw `err.message` (DB text, red). Success: `setEmail("")` (hours kept) + reload.
- Revoke: `rpc("revocar_acceso_soporte", { acceso_id: id })` (button `"Quitar ya"`, only for activo) + reload; error ignored.
- Row: `a.email`; status text: activo -> `` `Hasta ${new Date(a.expira_en).toLocaleString("es-ES")}` `` (**literal "Hasta" + hard-coded `es-ES`**, :115); `"Caducado"`; `"Revocado"`. For non-active rows a pill shows the raw word `{e}` = `caducado`/`revocado` (:129, untranslated; CSS uppercase). Status function (:63-67): `revocado_en` -> revocado; `new Date(a.expira_en).getTime() < Date.now()` -> caducado (**`Date.now()` in the render path, :64** = the lint `react-hooks/purity` error); else activo.
- Comment :243-249 ("Punto 17"): gives owner-level access to an ALREADY REGISTERED account for N hours; logged (who, when it expires, who removed it); switches off by itself after the hours.
- Discrepancy: AJU-03 matches; code-only: DB error text shown raw, hours field not reset after success.

---
## 10. ConfigurarObra — components/ajustes/ConfigurarObra.tsx (AJU-07; owner only, inside Sheet)

- State init: `lat=obra.lat`, `lng=obra.lng`, `radio=String(obra.radio_metros)`, `horaInicio=obra.hora_inicio_turno ?? ""`, `minutosAntes=String(obra.minutos_antes_permitidos)`.
- Texts: intro `"Esto es opcional: sin ubicación puesta, fichar funciona igual, solo que sin el aviso de «dentro/fuera de la obra». Sin hora de inicio, tampoco hay límite de cuándo se puede fichar la entrada."`; `"Ubicación de la obra"`: `tr("Puesta ({lat}, {lng})", {lat: toFixed(5), lng: toFixed(5)})` or `"Todavía sin poner."`; button `"Usar mi ubicación actual"` (spinner while locating); `"Radio que cuenta como «dentro de la obra» (metros)"` (`number inputMode=numeric min=20 step=10`); `"Hora de inicio del turno (opcional)"` (`type=time`); `"Minutos antes que se puede fichar la entrada"` (`number min=0 step=5`, **rendered only when `horaInicio` is non-empty**); button `"Guardar"` (spinner).
- GPS: `obtenerPosicion()` (lib/geo.ts, out of scope: `getCurrentPosition`, `enableHighAccuracy: true`, `timeout: 8000`, `maximumAge: 0`; resolves null on denial/unavailable/missing API). null -> `"No se pudo obtener la ubicación. Revisa el permiso de ubicación del navegador."`; else `lat/lng = pos.coords.latitude/longitude`.
- Write: `from("obras").update({ lat, lng, radio_metros: Number(radio) || 150, hora_inicio_turno: horaInicio || null, minutos_antes_permitidos: Number(minutosAntes) || 0 }).eq("id", obra.id).select().single()`. Error/no data -> `err?.message ?? tr("No se pudo guardar.")`; success -> `onGuardado(data as Obra)`.
- Discrepancies (AJU-07): spec "radius default 150, min 20" and "minutes default 30". Code: only the `|| 150` fallback for empty/0 radius; `min=20` is an HTML attribute not enforced (radius 1 saves); there is **no default 30 in code** (initial minutes = DB column value `obra.minutos_antes_permitidos`; save fallback is `0`, :57); minutes are saved even if the start time is empty (field hidden); location cannot be cleared once set. Comment typo :14-15 "Se piensa pensada ... rellenarse estando en la propia obra".

---
## 11. EliminarObra + lib/eliminar-obra.ts (AJU-08; owner only, inside Sheet)

- State: `nombre`, `password`, `borrando`, `error`. `nombreOk = nombre.trim() === obra.nombre` (case- and accent-sensitive; typed value trimmed, obra name not trimmed).
- UI: red warning `trJsx("Esto borra {siempre} todos los fichajes, gastos, fotos de recibos, cobros y notas de audio de «{obra}». No hay vuelta atrás y no queda copia en la app.", {siempre: tr("para siempre") bold, obra: obra.nombre})`; field `tr("Escribe «{obra}» para confirmar", {obra})` (ph = obra name, `autoComplete="off"`); field `"Tu contraseña"` (password, ph `"••••••••"`); typing in either clears `error`; error line red; button `tr("Borrar «{obra}» para siempre", {obra})` disabled when `!nombreOk || !password || borrando`.
- Flow (`eliminar`): return if `!nombreOk || !password`; `supabase.auth.getUser()` -> if no `user?.email`: `"No se pudo confirmar tu cuenta. Vuelve a iniciar sesión e inténtalo de nuevo."`; re-auth `supabase.auth.signInWithPassword({ email: user.email, password })` -> any error: `"Contraseña incorrecta."` (even network errors); then `eliminarObraDefinitivamente(supabase, obra.id)`; a returned message is shown raw; null -> `onEliminada()`.
- `eliminarObraDefinitivamente(supabase, obraId)` (comment eliminar-obra.ts:3-9: Storage files first "(fotos de recibos, audios — SQL no los toca)", then everything else in one server function = transaction; returns an error message or null):
  1. `Promise.all`: `from("gastos").select("recibo_path").eq("obra_id", obraId).not("recibo_path","is",null)`; `from("cobros").select("archivo_path").eq("obra_id", obraId).not("archivo_path","is",null)`; `from("notas_audio").select("audio_path").eq("obra_id", obraId)`.
  2. `facturas` bucket paths = gastos.recibo_path + cobros.archivo_path (falsy filtered); `notas` bucket paths = notas_audio.audio_path (falsy filtered).
  3. if any: `supabase.storage.from("facturas").remove(rutasFacturas)`; if any: `supabase.storage.from("notas").remove(rutasNotas)` (results and errors ignored).
  4. `supabase.rpc("eliminar_obra", { p_obra_id: obraId })` -> returns `error.message` or `null`.
- Discrepancies: none vs AJU-08. Observations: select/storage errors are ignored (orphan files possible); files of the legacy `facturas` table (`Factura.storage_path`) are not removed here (unclear whether migrated into `gastos.recibo_path`; see `Gasto.factura_origen_id`).

---
## 12. Gate screens (components/layout/)

### 12.1 PendienteAprobacion (ACC-09)
- Uses `useMiembro()` (`miembro, guardarNombre, refrescar`) and `useSession()` (e-mail `miembro?.email ?? session?.user.email ?? ""`). State: `nombre` init `miembro?.nombre ?? ""`, `guardando`, `comprobando`, `error`; `yaTieneNombre = Boolean(miembro?.nombre)`.
- Texts: title `"Cuenta creada"`; `tr("Tu cuenta")` + bold e-mail + `tr("ya existe, pero todavía no tiene acceso a las obras. El dueño tiene que aprobarla.")`; field `"Tu nombre y apellido"` (ph `"Ej. Andrés Gómez"`, `autoComplete="name"`); hint `"Escríbelo como te conocen en la obra: es lo que verá el dueño para saber que eres tú."`; button `"Enviar mi nombre"`, or with `yaTieneNombre`: check + `"Nombre guardado"` (still clickable when non-empty and not saving); spinner while saving. If `yaTieneNombre`: box `"Esperando a que te den acceso"` + `"Avisa al dueño. En cuanto te apruebe, entra desde aquí."` + button `"Comprobar de nuevo"` (icon spins while `comprobando`). Logout `"Cerrar sesión"` -> signOut, `router.push("/")`, refresh.
- Writes: `guardar` (if `nombre.trim()`): `guardarNombre(nombre.trim())` -> miembro-context (out of scope): `supabase.rpc("guardar_mi_nombre", { nuevo: nombre })`; on error returns `tr("No se pudo guardar el nombre. Inténtalo otra vez.")` (shown), on success reloads member data. `comprobar` -> `refrescar()` (re-reads `miembros` row by `user_id`, `soy_admin_plataforma`, `empresas`, `ajustes`).
- Comment :14-17: the person writes their name so the owner knows whom they approve; until approved they see nothing.
- Discrepancy: none vs ACC-09.

### 12.2 SuscripcionInactiva (ACC-10)
- No data. Title `"Suscripción inactiva"` (LockKeyhole); body `"El acceso de tu empresa está pausado. No se ha borrado nada: tus obras, horas y gastos siguen guardados y vuelven en cuanto se renueve la suscripción. Contacta con el administrador de la plataforma."`; button `"Salir"` (not "Cerrar sesión") -> signOut, `router.push("/")`, refresh. Comment: free trial over or blocked by platform admin; nothing is deleted.
- Trigger (out of scope, miembro-context): `from("empresas").select("activa_hasta, bloqueada").maybeSingle()`; inactive = `bloqueada || (activa_hasta && new Date(activa_hasta).getTime() <= Date.now())`. Comment there: read separately from `mi_empresa_id()` "porque esa deja de devolver nada justo cuando la suscripción está caducada".

### 12.3 AvisoControl (ACC-11)
- Uses `useMiembro().refrescar, modulos`. Title `"Antes de fichar"`. Paragraphs: (1) `tr("Esta app registra tu")` + bold `"hora de entrada y salida"` + `tr("con el reloj del servidor, no con el del móvil.")`; (2) `trJsx("Cuando fichas, la app también comprueba si tu móvil está {dentro}. No guarda tu ubicación exacta ni te sigue en ningún otro momento — solo ese resultado (dentro/fuera) en el instante de fichar.", {dentro: tr("dentro o fuera de la obra") bold})`; (3) `tr("Algunas obras tienen una")` + bold `"hora mínima para fichar la entrada"` + `tr(", para que no se pueda marcar la llegada antes de que empiece el turno.")`. Note: `"Al tocar «Lo he leído», el móvil te va a pedir permiso de ubicación. Acéptalo — así, cada vez que fiches, no hace falta pedirlo otra vez."` Button `"Lo he leído"` / `"Guardando…"`; logout `"Cerrar sesión"` (signOut, `router.push("/")`).
- `confirmar`: `if (modulos.geolocalizacion) await obtenerPosicion()` (result ignored; permission prompt once; comment :195-197 "Si dice que no, se ficha igual — no bloquea"); then `createClient().rpc("confirmar_aviso_control", { version: AVISO_CONTROL_VERSION })` (param is `version`, **no `p_`**); error -> `"No se pudo guardar. Inténtalo otra vez."`; success -> `refrescar()`.
- `AVISO_CONTROL_VERSION = "2026-09-28"` (types.ts:84; comment: "Si cambia el contenido de verdad, subir esta versión para que se vuelva a pedir la lectura a todo el mundo"). Component comment :178-185: informative notice, not a "firma"; what counts is proof that the person was told, when, and which text version.
- Discrepancy (ACC-11): the geolocation paragraph and the permission sentence are shown even when the geolocation module is OFF; only the permission prompt itself is conditional (AvisoControl.tsx:232-236, 245-247 vs spec ACC-11 "if the geolocation module is on"). Code wins.

---
## 13. UI + i18n modules

### 13.1 SelectorIdioma (ACC-13)
Three round buttons from `IDIOMAS`: `ES`, `UA`, `EN`; `aria-label` = language name (`Español`, `Українська`, `English`), `aria-pressed`; active = yellow. Calls `useIdioma().cambiarIdioma(id)`. Used in /login, /alta, Ajustes (gestor and worker). Not in reset-password, alta/ok, admin, gate screens.

### 13.2 Logo
Inline SVG `viewBox 0 0 100 100`, `fill none`, `stroke currentColor`, `strokeWidth 14`, miter joins, butt caps; paths `M14 70 L50 16 L86 70` (triangle) and `M38 88 L96 88` (offset lower beam); `aria-hidden`; props `size=28`, `className`. Comment: "triángulo construido con vigas, con una viga inferior desplazada ... hereda el color del texto (currentColor)". (Q-05.)

### 13.3 lib/i18n/index.ts (PLT-01)
- `type Idioma = "es"|"uk"|"en"`; `IDIOMAS = [{es,"Español","ES"},{uk,"Українська","UA"},{en,"English","EN"}]`; `COOKIE_IDIOMA = "idioma"`; `LOCALES = {es:"es-ES", uk:"uk-UA", en:"en-GB"}`; module variable `actual = "es"`; `fijarIdioma`, `idiomaActual`, `localeActual()`, `esIdioma(v)`.
- `idiomaDesde(preferidos[])`: per entry base = lowercased, split on `[-_;]`, first part trimmed; `uk|ru` -> uk; `es|ca|gl|eu` -> es; `en` -> en; first match wins; default `es`.
- `tr(texto, vars?)`: es -> key itself; else `DICCIONARIOS[actual][texto] ?? texto` (dictionaries `uk.ts`/`en.ts`, not in scope); `{name}` placeholders replaced via split/join for every var.
- `trJsx(texto, vars: Record<string,ReactNode>)`: `tr(texto)` (no vars), split on `/(\{\w+\})/`, each `{name}` found in `vars` replaced by the node (Fragment with key).
- `trN(n, uno, varios)`: if uk: forms = `DICCIONARIOS.uk[varios]` split on `"|"`; if 3 forms: `d=|n|%10`, `dd=|n|%100`; index 0 if `d===1 && dd!==11`, 1 if `d` in 2..4 and (`dd<12 || dd>14`), else 2; replace `{n}`. Otherwise `tr(n===1 ? uno : varios, {n})`.
- Comments: header "El texto se escribe en español directamente en el código, envuelto en tr("..."): ese mismo texto es la clave... Si falta una traducción, sale en español (nunca una clave rara ni un hueco vacío)"; module variable "para poder traducir también fuera de los componentes (lib/nav.ts, etiquetas de rol, formatos de fecha…). Cuando cambia, IdiomaProvider vuelve a montar toda la app".

### 13.4 lib/i18n/provider.tsx
`IdiomaProvider({inicial, children})`: state `idioma` from `inicial` (decided by the server: cookie, else phone language; root layout out of scope); calls `fijarIdioma(idioma)` **during render** (comment "Antes de pintar a los hijos: t() lee esta variable"); effect sets `document.documentElement.lang = idioma`; `cambiarIdioma(i)`: `document.cookie = "idioma=<i>; path=/; max-age=31536000; samesite=lax"` then `setIdioma(i)`; children wrapped in `<Fragment key={idioma}>` (whole app remounts on change, local state is lost). `useIdioma()` throws `"useIdioma debe usarse dentro de <IdiomaProvider>"` outside the provider.

### 13.5 Error logging (PLT-03)
- `lib/errores.ts` `reportarError(error, extra?)`: never throws (outer try/catch). `mensaje = (e?.message ?? String(error ?? "")).slice(0,500) || "(sin mensaje)"`; ignore regex `/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch|NetworkError/i`; dedupe key `mensaje + (stack?.slice(0,200) ?? "")` in a per-page `Set`; cap `MAX_POR_PAGINA = 20`; `digest = e && "digest" in e ? " [digest X]" : ""`; fire-and-forget `createClient().rpc("registrar_error", { p_origen: "navegador", p_mensaje: mensaje + digest, p_detalle: [extra, e?.stack].filter(Boolean).join("\n").slice(0,4000) || null, p_ruta: location.pathname + location.search (null when no `location`), p_navegador: navigator.userAgent (null when no navigator) })` with `.then(noop, noop)`. Comment: "lo último que queremos es que el aviso de un error provoque otro". Table `errores_app` (supabase/migracion-errores.sql, not in scope).
- `instrumentation.ts` `onRequestError(err, request, context)` (server): needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (else returns); `fetch(`${url}/rest/v1/rpc/registrar_error`, { method: "POST", headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" }, body: { p_origen: "servidor", p_mensaje: (e?.message ?? String(err)) + digest, p_detalle: [`${request.method} · ${context.routeType} · ${context.routePath}`, e?.stack].filter(Boolean).join("\n"), p_ruta: request.path, p_navegador: String(request.headers["user-agent"] ?? "") }, signal: AbortSignal.timeout(3000) })`; failures swallowed. Comment: awaited because Next requires it, never more than 3 s. No client-side truncation/dedupe/regex on the server path (truncation is DB-side per spec PLT-03).
- `instrumentation-client.ts`: `window.addEventListener("error", ev => reportarError(ev.error ?? ev.message, ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined))`; `window.addEventListener("unhandledrejection", ev => reportarError(ev.reason, "promesa sin capturar"))`. Comment: "se guardan para verlos en /admin (Fase 4, punto 24). Los que pinta React los recoge app/error.tsx."

---
## 14. Cross-cutting local state
| Kind | Key | Where |
|---|---|---|
| localStorage | `control-de-obra:email` | login (read on mount, write on login success) |
| cookie | `idioma` (path=/, max-age 31536000, samesite=lax) | i18n provider |
| localStorage (out of scope, reference) | `control-de-obra:obra-id` | obra-context |
| window events | only `error` / `unhandledrejection` listeners | instrumentation-client |
| DOM | `document.documentElement.lang` | provider |

## 15. Lessons in comments (consolidated, file:line)
- login/page.tsx:17, 52-53, 77-78, 104-105, 161-162, 267-268 (see §1).
- Accesos.tsx:27-31 role escalation is blocked in the DB too.
- SoporteAcceso.tsx:243-249 grants expire by themselves.
- EliminarObra.tsx:129-134 double-lock rationale (exact name "para no borrar la de al lado por un toque en falso"; password so it is not "un toque más sin pensarlo"); eliminar-obra.ts:3-9 Storage first, then one transaction.
- AvisoControl.tsx:178-185, 195-197; types.ts:81-83 bump the version only when the text really changes.
- ConfigurarObra.tsx:12-15 meant to be filled while standing on the site.
- PendienteAprobacion.tsx:14-17; SuscripcionInactiva.tsx:130-133 (nothing is deleted).
- admin/layout.tsx:12-18 admin = a completely separate account class.
- pagos.ts:3-5 secrets server-only, missing keys = payment "no disponible" instead of breaking; :26 `DIAS_MARGEN`; webhook route.ts:6-9 signature mandatory.
- i18n/index.ts header (Spanish fallback); errores.ts:3-7; instrumentation.ts:3-6; instrumentation-client.ts:3-5.

---
## 16. Discrepancy list (code vs spec), consolidated
| # | Where | Spec ID | Detail |
|---|---|---|---|
| D1 | SoporteAcceso.tsx:64 | §20.5 | `Date.now()` in render for status (lint `react-hooks/purity`). |
| D2 | SoporteAcceso.tsx:115 | §20.3 | `` `Hasta ${...toLocaleString("es-ES")}` `` hard-coded Spanish + locale. |
| D3 | SoporteAcceso.tsx:129 | §20.3 | raw lower-case status word `{e}` (`caducado`/`revocado`) untranslated. |
| D4 | admin/page.tsx:13 | §20.3 | `fecha()` hard-coded `es-ES`. |
| D5 | admin/page.tsx:249 | §20.3 | literal `"cancelado"` untranslated. |
| D6 | alta/page.tsx:46-50 | §20.3 | `/alta` price formatted with `"es-ES"` regardless of language. |
| D7 | Accesos.tsx:25, 219 | new | role label in member rows not passed through `tr()` (untranslated in uk/en). |
| D8 | login/page.tsx:272 | new | `error.startsWith("Contraseña incorrecta")` fails once translated: extra hint hidden in uk/en. |
| D9 | ajustes/page.tsx:143-147 | AJU-04 | jornada accepts any `>0 && <=24` (0.5 ok); `min=1` not enforced. |
| D10 | ConfigurarObra.tsx:55, 57, 91, 105 | AJU-07 | no JS min 20 on radius; "default 30" minutes not in code (DB default; save fallback `0`); minutes saved even when hidden. |
| D11 | AvisoControl.tsx:232-236, 245-247 | ACC-11 | geolocation text shown even when module OFF. |
| D12 | ajustes/page.tsx:102 vs :381 | AJU-W1 | gestor logout -> `/login`; worker logout -> `/` (spec silent). |
| D13 | pagos.ts:38-45 | ONB-03 | `incomplete_expired` also = now; end floored at now (+3 d). |
| D14 | Accesos.tsx:112-117 | new | copy-invitation clipboard write without try/catch (admin and alta/ok have one). |
| D15 | Accesos/ajustes/admin writes | new | most write errors silently ignored (`actualizar`, `eliminar`, toggles, adds, `revocar`, `cancelar`, `ponerSuscripcion`, `borrar_errores_admin`); `eliminar` removes the row from the list even if the DB delete failed. |
| D16 | alta/ok/page.tsx | ONB-02 | no polling: a 409 "todavía no completado" renders as "Pago sin confirmar". |
| D17 | admin/layout.tsx:40-48 | §15 | with no session "Esto no es para esta cuenta" flashes before redirect to /login. |
| D18 | inserts of trabajadores/vehiculos/obras/ajustes | PLT-06 | client sends `owner_id: user.id`, no `empresa_id`; how `empresa_id` is set is unclear (DB side). |

---
## Data-access methods needed

`{...}` = shape the UI reads. Every distinct operation of this area (plus the context hooks it relies on).

**Auth**
- `iniciarSesion(email, password)` → `auth.signInWithPassword({ email, password })` → `{error?: {message}}`; UI branches on `message === "Invalid login credentials"` / `"Email not confirmed"`.
- `registrarse(email, password, meta)` → `auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/login`, data: meta } })`; `meta` = `{empresa_codigo, nombre, apellidos}` or `{codigo_alta, nombre_empresa, nombre, apellidos}` → `{error?}`.
- `enviarEnlaceRecuperacion(email)` → `auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })` → `{error?}`.
- `cambiarPassword(password)` → `auth.updateUser({ password })` → `{error?: {message}}` (UI tests `message.includes("session")`).
- `cerrarSesion()` → `auth.signOut()`.
- `obtenerUsuario()` → `auth.getUser()` → `{data:{user:{id, email}}}` (id used as `owner_id`; email used for re-auth).
- `obtenerSesion()` + `suscribirSesion(cb)` → `auth.getSession()` + `auth.onAuthStateChange((_event, session) => ...)` (`useSession`: `{session, loading}`).
- `reautenticar(email, password)` → `auth.signInWithPassword({ email, password })` (delete-obra lock).

**Registration / platform**
- `comprobarCodigoRegistro(codigo)` → `rpc('comprobar_codigo_registro', { p_codigo })` → `{tipo: 'empresa'|'alta'|other, nombre: string|null}[]`; UI uses element `[0]`; no row or error = invalid.
- `soyAdminPlataforma()` → `rpc('soy_admin_plataforma')` → boolean (`Boolean(data)`).
- `registrarError({origen, mensaje, detalle, ruta, navegador})` → `rpc('registrar_error', { p_origen, p_mensaje, p_detalle, p_ruta, p_navegador })` (fire-and-forget; browser via client, server via raw `fetch POST {SUPABASE_URL}/rest/v1/rpc/registrar_error` with the anon key).

**Billing (server, service role)**
- `precioAlta()` (route GET) → `stripe.prices.retrieve(STRIPE_PRICE_ID)` → `{disponible:false} | {disponible:true, importe, moneda, intervalo}`.
- `abrirPagoAlta(email?)` (route POST) → `stripe.checkout.sessions.create({...see §5.1})` → `{url}` | `503 {error}`.
- `codigoDePago(sessionId)` → `stripe.checkout.sessions.retrieve(id, {expand:["subscription"]})` + `adminDb().rpc('registrar_pago_alta', { p_session, p_email, p_customer, p_subscription, p_pagado_hasta })` → `string` (alta code) | `null`.
- `actualizarPagoSuscripcion(subscriptionId, pagadoHasta)` → `adminDb().rpc('actualizar_pago_suscripcion', { p_subscription, p_pagado_hasta })` → `{error?}`.
- `verificarFirmaWebhook(rawBody, header, secret)` → `stripe.webhooks.constructEvent(...)`.
- `pagadoHasta(sub)` pure function (rule in §5.4).

**Platform admin**
- `listarEmpresasAdmin()` → `rpc('listar_empresas_admin')` → `EmpresaAdmin[] {id, nombre, codigo, created_at, miembros_count, obras_count, activa_hasta: string|null, bloqueada, codigo_alta: string|null}`.
- `listarCodigosAlta()` → `rpc('listar_codigos_alta')` → `CodigoAlta[] {id, codigo, nota, creado_en, estado:'libre'|'usado'|'cancelado', empresa_nombre, usado_en, email, pagado}`.
- `listarErroresAdmin(limite = 100)` → `rpc('listar_errores_admin', { p_limite })` → `ErrorApp[] {id:number, creado_en, origen:'navegador'|'servidor', mensaje, detalle, ruta, navegador, email, empresa}`.
- `crearCodigoAlta(nota)` → `rpc('crear_codigo_alta', { p_nota })` → `string` (the code).
- `cancelarCodigoAlta(id)` → `rpc('cancelar_codigo_alta', { p_id })`.
- `establecerSuscripcion(empresaId, activaHasta: string|null, bloqueada)` → `rpc('establecer_suscripcion', { p_empresa, p_activa_hasta, p_bloqueada })`.
- `borrarErroresAdmin()` → `rpc('borrar_errores_admin')`.

**Member / company (gates + settings)**
- `leerMiMiembro(userId)` → `from('miembros').select('*').eq('user_id', userId).maybeSingle()` → `Miembro` (out-of-scope context; used by gates).
- `leerEstadoSuscripcion()` → `from('empresas').select('activa_hasta, bloqueada').maybeSingle()` (gate; out of scope).
- `leerCodigoEmpresa()` → `from('empresas').select('codigo').limit(1).maybeSingle()` → `{codigo}` (invitation link).
- `guardarMiNombre(nombre)` → `rpc('guardar_mi_nombre', { nuevo })` → `{error?}` (then re-read the member).
- `confirmarAvisoControl(version)` → `rpc('confirmar_aviso_control', { version })` → `{error?}` (no `p_` prefix).
- `listarMiembros()` → `from('miembros').select('*').order('created_at', { ascending: true })` → `Miembro[] {user_id, email, nombre, rol, obra_id, trabajador_id, aprobado, aviso_control_leido_en, aviso_control_version, es_soporte, created_at}`.
- `actualizarMiembro(userId, cambios)` → `from('miembros').update(cambios).eq('user_id', userId).select().single()` → `Miembro` (cambios used: `{rol, obra_id?: null}`, `{obra_id}`, `{trabajador_id}`, `{aprobado}`).
- `eliminarMiembro(userId)` → `from('miembros').delete().eq('user_id', userId)`.
- `listarTrabajadores()` → `from('trabajadores').select('*').order('nombre')` → `Trabajador[] {id, owner_id, nombre, activo, created_at}`.
- `crearTrabajador(ownerId, nombre)` → `from('trabajadores').insert({ owner_id, nombre }).select().single()`.
- `cambiarActivoTrabajador(id, activo)` → `from('trabajadores').update({ activo }).eq('id', id).select().single()`.
- `listarVehiculos()` → `from('vehiculos').select('*').order('nombre')` → `Vehiculo[] {id, owner_id, nombre, activo, created_at}`.
- `crearVehiculo(ownerId, nombre)` → `from('vehiculos').insert({ owner_id, nombre }).select().single()`.
- `cambiarActivoVehiculo(id, activo)` → `from('vehiculos').update({ activo }).eq('id', id).select().single()`.
- `leerAjustes()` → `from('ajustes').select('jornada_horas,jefe_ve_todas').maybeSingle()` (obra-context) and `from('ajustes').select('*').limit(1).maybeSingle()` (modules: `mod_vehiculos | mod_notas_voz | mod_caja_jefe | mod_transporte | mod_geolocalizacion` booleans).
- `guardarJornada(ownerId, horas)` → `from('ajustes').upsert({ owner_id, jornada_horas, updated_at: ISO })`.
- `guardarJefeVeTodas(ownerId, valor)` → `from('ajustes').upsert({ owner_id, jefe_ve_todas, updated_at: ISO })`.
- `guardarModulo(ownerId, clave, valor)` → `from('ajustes').upsert({ owner_id, ['mod_' + clave]: valor, updated_at: ISO })`.

**Support access**
- `listarAccesosSoporte()` → `from('soporte_accesos').select('*').order('otorgado_en', { ascending: false })` → `SoporteAcceso[] {id, empresa_id, otorgado_a, email, otorgado_por, otorgado_en, expira_en, revocado_en, revocado_por}`.
- `darAccesoSoporte(email, horas)` → `rpc('dar_acceso_soporte', { email_soporte, horas })` → `{error?: {message}}` (message shown raw).
- `revocarAccesoSoporte(id)` → `rpc('revocar_acceso_soporte', { acceso_id })`.

**Obras (settings use)**
- `listarObras()` → `from('obras').select('*').order('created_at', { ascending: false })` → `Obra[] {id, owner_id, nombre, direccion, activa, lat, lng, radio_metros, hora_inicio_turno: 'HH:MM'|null, minutos_antes_permitidos, created_at}`.
- `crearObra(ownerId, nombre, direccion)` → `from('obras').insert({ owner_id, nombre, direccion: direccion || null, activa: true }).select().single()`.
- `cambiarActivaObra(id, activa)` → `from('obras').update({ activa }).eq('id', id).select().single()`.
- `guardarUbicacionHorarioObra(id, { lat, lng, radio_metros, hora_inicio_turno, minutos_antes_permitidos })` → `from('obras').update({...}).eq('id', id).select().single()` → `Obra` (owner only in the UI).
- `eliminarObraDefinitivamente(obraId)` → (a) `from('gastos').select('recibo_path').eq('obra_id', obraId).not('recibo_path','is',null)`; (b) `from('cobros').select('archivo_path').eq('obra_id', obraId).not('archivo_path','is',null)`; (c) `from('notas_audio').select('audio_path').eq('obra_id', obraId)`; (d) `storage.from('facturas').remove([...recibo_path, ...archivo_path])` if any; (e) `storage.from('notas').remove([...audio_path])` if any; (f) `rpc('eliminar_obra', { p_obra_id })` → returns `error.message | null`.

**Device helpers (not DB)**
- `obtenerPosicion()` → `navigator.geolocation.getCurrentPosition(highAccuracy, timeout 8000 ms, maximumAge 0)` → `GeolocationPosition | null`.
- `idioma` cookie get/set (`idioma`, 1 year) and `idiomaDesde(listaDeIdiomas)`.
- `emailRecordado` → `localStorage['control-de-obra:email']` get/set.
