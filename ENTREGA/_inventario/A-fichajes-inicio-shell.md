# Inventario A — Fichajes, Inicio, Shell (v1, solo lectura)

Fuente: `C:\Projects\apps\claude\_ref-v1\` + `_pack\ESPECIFICACION-ESTRUCTURA.md` (= SPEC). Rutas relativas a `_ref-v1`.
Convenciones: `file:line` = línea del v1. "tr()" = clave i18n (texto español exacto). "RLS" = lo decide la BD, no el cliente.
Nota: `lib/modulos.ts` y `lib/types.ts` no están en mi ámbito, pero cito lo imprescindible (`rutaApagada`, `AVISO_CONTROL_VERSION = "2026-09-28"`).

---

## 0. Mapa de proveedores y orden de montaje

`app/layout.tsx` → `ServiceWorkerRegister` + `IdiomaProvider` → ruta.
`app/(dashboard)/layout.tsx:9-17`: `AuthGate` → `MiembroProvider` → `AccesoGate` → `ObraProvider` → `DashboardShell` → página.
(`/` y `/fichajes` viven en el grupo `(dashboard)`, así que la landing anónima la pinta `AuthGate` dentro de ese layout, no una ruta aparte.)

Eventos `window`: `obra:refrescar` (PullToRefresh lo emite; solo escuchan `fichajes/page.tsx:91` (`cargarFichajes`), `MiFichaje.tsx:426` (`cargar`), `dinero/page.tsx:98`, `gastos/page.tsx:85-86`). **Home (gestor y trabajador) NO escucha.** `online` (offline-fichajes).
localStorage: `control-de-obra:obra-id` (obra-context), `obra_fichajes_pendientes` (cola offline). Cookie `idioma` (layout, SPEC PLT-01). `control-de-obra:email` no está en mi ámbito.

---

## 1. Raíz / PWA / errores

### app/layout.tsx — RootLayout (SPEC PLT-01, PLT-02, PLT-04)
- Servidor. `dynamic = "force-dynamic"` (:59; lección: todo depende de sesión+Supabase, el build fallaría sin env).
- Idioma: cookie `COOKIE_IDIOMA` si `esIdioma(valor)`; si no `idiomaDesde(accept-language.split(","))` (:63-66). `<html lang={idioma}>`.
- Fuentes next/font/google: Barlow_Condensed (600/700/800, `--font-barlow-condensed`), Inter (400-700, `--font-inter`), JetBrains_Mono (400/500/700, `--font-jetbrains-mono`). Clases `h-full antialiased`; body `min-h-full bg-obra-bg text-obra-text`.
- metadata: title "Control de Obra"; description "Fichajes, vehículos, gastos y facturas de tus obras, en un solo sitio."; manifest `/manifest.webmanifest`; icons 192/512 png + apple `/icons/apple-touch-icon.png`; appleWebApp {capable, statusBarStyle "black-translucent", title "Control de Obra"}.
- viewport: themeColor `#f7f3ec`, width device-width, initialScale 1, `viewportFit: "cover"` (:49-53 lección: sin cover la barra de estado tapa la cabecera en iPhone instalado; safe-area con env()).
- Estas strings del metadata NO pasan por tr() (description sigue siendo español fijo) — SPEC no lo menciona.

### app/error.tsx — ErrorPantalla (PLT-03)
- Cliente. `useEffect → reportarError(error, "pantalla (error.tsx)")` (:12). Botón llama `retry()` (:22).
- UI: icono AlertTriangle; tr("Algo ha fallado"); tr("Ya nos ha llegado el aviso. Prueba otra vez; si sigue pasando, vuelve más tarde."); botón tr("Reintentar").
- Discrepancia técnica: Next 16 pasa la prop `unstable_retry`/`reset`; el v1 declara `retry` (`error.tsx:10`, `global-error.tsx:11`). Si Next no la inyecta con ese nombre, el botón lanzaría TypeError. **Unclear** (no verificado contra docs de Next 16 de este repo).

### app/global-error.tsx — GlobalError (PLT-03)
- Cliente; `reportarError(error, "global-error")`. Sin estilos ni i18n (:6-10): `<html lang="es">` fijo, estilos inline (bg `#f7f3ec`, texto `#211c15`, botón `#e0a526`).
- Textos trilingües fijos: "Algo ha fallado · Щось пішло не так · Something went wrong"; botón "Reintentar · Спробувати ще · Retry".

### components/ServiceWorkerRegister.tsx
- Monta en layout. `navigator.serviceWorker.register("/sw.js")`; el `catch` se ignora (la app sigue). Renderiza `null`.

### public/sw.js (PLT-02)
- `CACHE_NAME = "control-de-obra-v2"`. `install` → `skipWaiting()`. `activate` → borra TODAS las cachés (`caches.keys()` → delete) + `clients.claim()`.
- `fetch`: ignora `request.mode === "navigate"` y no-GET (:27-28). Resto: network-first; si `response.ok` y mismo origen → `cache.put`; en fallo de red → `caches.match`.
- Lección (:4-8): NO cachear navegaciones (el móvil se quedaba con versión antigua); offline real = cola de datos aparte.
- Nota: cachea también GETs same-origin de `/api/*` y RSC si no son "navigate" — SPEC solo dice "static GETs". Anotado.

### proxy.ts + lib/supabase/middleware.ts (ACC-07)
- `proxy()` → `updateSession(request)`. Matcher: `/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)`. (Nota: `.xlsx` NO está excluido; por eso `/plantilla-plan-obra.xlsx` está en PUBLIC_PATHS.)
- Cliente `createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` con cookies getAll/setAll (reescribe `request.cookies` y recrea `NextResponse.next({request})`).
- Lectura: `supabase.auth.getUser()` (refresca sesión).
- Públicas por `startsWith`: `/login`, `/reset-password`, `/alta`, `/api/alta`, `/api/stripe`, `/plantilla-plan-obra.xlsx`; exacta: `/` (:9-10; lección :4-7: `/` con startsWith lo dejaría todo público).
- Sin user y no pública → redirect `/login` (clona URL, pathname `/login`; pierde query). Con user y path `startsWith("/login")` → redirect `/` (:15 y :58). `/reset-password` NO redirige (:11-14 lección).
- Discrepancia/observación: `startsWith("/alta")` también deja pasar `/altaXYZ`; irrelevante. `/admin` no tiene regla propia (lo resuelve el cliente). No hay redirección de trabajador/admin en proxy.

---

## 2. Guardas y contextos (cadena ACC-08)

### lib/use-session.ts — `useSession()`
- Lee `supabase.auth.getSession()` al montar (local, sin red) → `{session, loading}`; `onAuthStateChange` actualiza `session` (no toca `loading`). Cleanup `unsubscribe`.

### components/layout/AuthGate.tsx (ACC-01, ACC-08 paso 1)
- `loading` → spinner `Loader2` (min-h 100dvh, bg-obra-bg, text-obra-yellow). Sin sesión → `<LandingMock/>`. Con sesión → children.
- Sin textos.

### lib/miembro-context.tsx — `MiembroProvider` / `useMiembro()` (ACC-08, §1)
Carga (`cargar`, al montar y en `refrescar()`):
1. `supabase.auth.getUser()`; sin user → `miembro=null, esAdmin=false, loading=false`, return.
2. En paralelo: `from("miembros").select("*").eq("user_id", user.id).maybeSingle()` (:60; lección :56-58 filtrar por user_id: el dueño lee todas las filas) y `rpc("soy_admin_plataforma")`.
3. `from("empresas").select("activa_hasta, bloqueada").maybeSingle()` (:68-71; lección :65-67: se lee aparte porque `mi_empresa_id()` devuelve NULL justo con suscripción caducada). `suscripcionInactiva = empresa && (bloqueada || (activa_hasta && new Date(activa_hasta).getTime() <= Date.now()))`.
4. `from("ajustes").select("*").limit(1).maybeSingle()` → `modulosDesdeFila` (defaults todo ON; `mod_<clave>` booleano).
Errores de estas lecturas se ignoran (no se mira `error`).
Derivados: `rol = miembro?.aprobado ? miembro.rol : null`; `esDueno = rol==="dueno"`; `esTrabajador = rol==="trabajador"`; `gestiona = dueno|manager|jefe_obra`; `esAdminPlataforma = Boolean(admin.data)`.
Escrituras:
- `guardarModulo(clave, valor)`: `auth.getUser()`; set local optimista; `from("ajustes").upsert({ owner_id: user.id, ["mod_"+clave]: valor, updated_at: ISO })` (sin `onConflict`; clave primaria por defecto — **unclear** si PK es `owner_id`/`empresa_id`; SPEC dice 1 fila por empresa). Error no se muestra ni se revierte.
- `guardarNombre(nombre)`: `rpc("guardar_mi_nombre", { nuevo: nombre })`; error → devuelve tr("No se pudo guardar el nombre. Inténtalo otra vez."); OK → `cargar()` y `null`.
Quién ve qué: contexto global; `rol` null mientras no aprobado.

### components/layout/AccesoGate.tsx (ACC-08 pasos 2-6, ACC-11)
Condiciones (:20-27):
- `necesitaLeerAviso = esTrabajador && miembro?.aprobado && miembro.aviso_control_version !== AVISO_CONTROL_VERSION`.
- `rutaProhibida = (esTrabajador && RUTAS_SOLO_GESTORES.some(r => pathname.startsWith(r))) || (!loading && rutaApagada(pathname, modulos))` → `router.replace("/")` en efecto.
- Admin: `!loading && esAdminPlataforma` → `router.replace("/admin")`.
Orden de render: (`loading || rutaProhibida || esAdminPlataforma`) → spinner (`Loader2`, 26) → `!miembro?.aprobado` → `<PendienteAprobacion/>` → `suscripcionInactiva` → `<SuscripcionInactiva/>` → `necesitaLeerAviso` → `<AvisoControl/>` → children.
Sin textos propios.
- Obs: un usuario sin fila `miembros` (miembro=null) cae en Pendiente (salvo admin). El manager/jefe NO tiene bloqueo de rutas aquí (`/dinero` para jefe lo resuelve la página, fuera de mi ámbito).

### lib/obra-context.tsx — `ObraProvider` / `useObra()` (SHL-05, FIC, AJU-04/05)
Lecturas:
- Mount: `from("ajustes").select("jornada_horas,jefe_ve_todas").maybeSingle()` → `jornadaHoras = Number(jornada_horas)` si truthy (default 8) ; `jefeVeTodas = Boolean(...)`. (Segunda lectura de `ajustes`, además de Miembro.)
- `cargar()` (mount y `refrescar()`): `from("obras").select("*").order("created_at",{ascending:false})` (incluye cerradas; RLS filtra por rol). Si OK: `setObras`; selección de obra: si `current` (sesión) existe en datos → se mantiene (aunque cerrada, :92-96); si no, `localStorage["control-de-obra:obra-id"]` si está entre activas; si no `activas[0]?.id ?? data[0]?.id ?? null`. `loading=false` siempre (aunque haya error). Error de red → obras queda `[]` y se muestra "crea tu primera obra"/"sin obra" (**quirk**: error ≡ sin obras).
- El arranque en frío NO escribe localStorage (solo `setObraId` lo hace).
Escrituras:
- `setObraId(id)`: estado + `localStorage.setItem("control-de-obra:obra-id", id)`.
- `crearObra(nombre, direccion)`: `auth.getUser()`; `from("obras").insert({ owner_id: user.id, nombre, direccion: direccion || null, activa: true }).select().single()`; error → devuelve `null` **sin mensaje**; OK → antepone a `obras` y `setObraId(data.id)`.
- `toggleObraActiva(id)`: `from("obras").update({ activa: !obra.activa }).eq("id", id).select().single()`; error silencioso.
- `guardarJornada(horas)`: `upsert({ owner_id: user.id, jornada_horas: horas, updated_at })` en `ajustes`; `guardarJefeVeTodas(valor)`: `upsert({ owner_id, jefe_ve_todas: valor, updated_at })`. Ambos optimistas, errores ignorados.
Exporta `todayStr` re-exportado.
- Obs: usa `owner_id` (v1) mientras SPEC §17 habla de `empresa_id`/una fila por empresa; el trigger/BD lo resuelve. **Unclear**.

---

## 3. Shell

### components/layout/DashboardShell.tsx (SHL-01, SHL-06, SHL-08)
- Lee `obras, loading` y `gestiona`. Estructura: `Sidebar` + columna (`min-w-0` imprescindible :20-24) con `TopBar`, `main`, `BottomNav` (solo si `obras.length>0`).
- `loading` → spinner. `obras.length===0` → `gestiona ? <SinObras/> : <SinObrasAsignadas/>`. Si no → `<PullToRefresh><div max-w-3xl px-4 pb-28 pt-4 md:px-6 md:py-6>children</div></PullToRefresh>`.
- Contenido ≤ `max-w-3xl` (768 px), centrado. Sidebar `hidden md:flex` (≥768 px) w-60; BottomNav `md:hidden`.

### components/layout/Sidebar.tsx (SHL-01, SHL-02, ACC-14)
- Items = `navLateral(rol, modulos)`; activo si `pathname === item.href` (exacto).
- Logo+texto tr("Control de Obra") enlaza `/` con aria-label tr("Ir a inicio"). Botón tr("Cerrar sesión"): `supabase.auth.signOut()` → `router.push("/login")` + `router.refresh()`.
- Etiquetas vía `tr(item.label)`.

### components/layout/BottomNav.tsx (SHL-02)
- Solo móvil (`md:hidden`). Items `navMovil(rol, modulos)`; icon-only (sin texto visible), `aria-label={tr(item.label)}`; activo `pathname === item.href`.

### lib/nav.ts (SHL-02, §1.3)
- `NAV_ITEMS` (barra móvil gestores): Fichajes `/fichajes`, Vehículos `/vehiculos`, Gastos `/gastos`, Dinero `/dinero`, Notas de voz `/notas`, Ajustes `/ajustes`.
- `NAV_TRABAJADOR`: Inicio `/`, "Mis horas" `/fichajes`, Vehículos, Ajustes.
- `jefe_obra` → quita `/dinero` (`seccionesDe`). Módulo OFF → `rutaApagada` quita `/vehiculos`, `/notas`.
- Lateral (no trabajador): Inicio, Planificación `/planificacion`, secciones (sin Ajustes), Resumen `/resumen`, Ajustes. Trabajador: igual que su móvil.
- Iconos lucide: Clock, Truck, Receipt, Wallet, Mic, Settings2, Calendar (Resumen), CalendarRange (Planificación), LayoutDashboard (Inicio).
- `RUTAS_SOLO_GESTORES = ["/gastos","/facturas","/notas","/resumen","/planificacion","/dinero"]`.
- Lecciones: :22-23, :37-39 (7º icono no cabe en iPhone estrecho), :57-59 (jefe no ve Dinero).
- Obs: el manager **sí** ve `/dinero` en el nav; `rol=null` (no aprobado) recibe la barra de gestores (nunca visible por AccesoGate).

### components/layout/TopBar.tsx (SHL-03)
- `obras.length===0` → `null`. Sticky, padding superior `calc(0.75rem + env(safe-area-inset-top))` (:22-23).
- Logo → `/` (aria tr("Ir a inicio")), solo móvil (`md:hidden`, :26 "emblema lleva siempre a Inicio").
- Botón de obra: punto `CircleDot` verde si `obraActual?.activa !== false`, gris si cerrada; nombre o tr("Elegir obra"). Abre `Sheet` título tr("Elegir obra") con `ObraPicker`.
- Si `gestiona`: enlace `/resumen` con aria-label tr("Resumen mensual") (en móvil **y** escritorio; SPEC solo dice "shortcut", Resumen móvil → top bar).

### components/layout/ObraPicker.tsx (SHL-04)
- Lista `obras.filter(o => o.activa)`; tocar → `setObraId(id)` + `onDone()`. Obra actual marcada (Check). Muestra `direccion` si hay.
- Botón tr("Nueva obra") para **todos los roles** (SPEC §20.1). Formulario: Field tr("Nombre de la obra") placeholder tr("Ej. Demolición C/ Mayor 12"); tr("Dirección (opcional)") placeholder tr("Ej. Calle Mayor 12, Madrid"); botón tr("Crear obra") deshabilitado si `!nombre.trim() || guardando`. `crearObra(nombre.trim(), direccion.trim())`; si devuelve obra → `onDone()`; si `null` el panel se queda sin mensaje de error.
- Sin estado "no hay obras activas" (lista vacía sin texto).

### components/layout/SinObras.tsx (SHL-06)
- Gestores sin obras. Textos: tr("Crea tu primera obra"), tr("Fichajes, gastos y facturas se organizan por obra."), mismos campos que ObraPicker, botón tr("Crear obra") (con icono Plus), deshabilitado si `!nombre.trim() || guardando`. `crearObra` sin mensaje de error en fallo.

### components/layout/SinObrasAsignadas.tsx (SHL-06)
- tr("Todavía no hay obra"), tr("Cuando te asignen una obra la verás aquí y podrás fichar tus horas.").

### components/layout/PullToRefresh.tsx (SHL-07)
- `useEnRefresco(cb)`: añade/quita listener `window` "obra:refrescar" (llama `cb()`).
- `PullToRefresh`: `touchstart` (solo si `window.scrollY===0` y no `girando`), `touchmove` (distancia = `min(delta*0.5, 90)`; cancela si delta ≤ 0 o scrollY>0), `touchend`: si distancia > `UMBRAL` (70) → `girando`, altura 40, `window.dispatchEvent(new Event("obra:refrescar"))`, a los 700 ms reset. (O sea hay que arrastrar > 140 px de dedo.) Spinner `Loader2` gira si `girando || altura>70`. Sin texto.
- No recarga contextos (obras/miembro); solo avisa a pantallas.

### components/layout/PendienteAprobacion.tsx (ACC-09)
- Usa `useMiembro` (`miembro`, `guardarNombre`, `refrescar`) y `useSession` (email de respaldo: `miembro?.email ?? session?.user.email`).
- Estado: `nombre` (init `miembro?.nombre`), `guardando`, `comprobando`, `error`. `yaTieneNombre = Boolean(miembro?.nombre)`.
- Guardar: `if (!nombre.trim()) return`; `guardarNombre(nombre.trim())`; fallo → muestra el texto devuelto.
- Comprobar: `refrescar()` (relee miembro/empresa/ajustes).
- Salir: `signOut()` → `router.push("/")` + `refresh()`.
- Textos: tr("Cuenta creada"); tr("Tu cuenta") + email + tr("ya existe, pero todavía no tiene acceso a las obras. El dueño tiene que aprobarla."); Field tr("Tu nombre y apellido") placeholder tr("Ej. Andrés Gómez"); ayuda tr("Escríbelo como te conocen en la obra: es lo que verá el dueño para saber que eres tú."); botón: guardando→spinner, `yaTieneNombre` → tr("Nombre guardado") (con Check), si no tr("Enviar mi nombre") (deshabilitado si `!nombre.trim() || guardando`); bloque (solo si `yaTieneNombre`): tr("Esperando a que te den acceso"), tr("Avisa al dueño. En cuanto te apruebe, entra desde aquí."), botón tr("Comprobar de nuevo"); tr("Cerrar sesión").
- Obs: como el registro suele guardar `nombre` por metadata, el bloque "Esperando…" suele aparecer de inmediato.

### components/layout/SuscripcionInactiva.tsx (ACC-10)
- tr("Suscripción inactiva"); tr("El acceso de tu empresa está pausado. No se ha borrado nada: tus obras, horas y gastos siguen guardados y vuelven en cuanto se renueve la suscripción. Contacta con el administrador de la plataforma."); botón tr("Salir") (signOut → `/`).
- Obs: la etiqueta del logout aquí es "Salir" (en otras gates "Cerrar sesión").

### components/layout/AvisoControl.tsx (ACC-11)
- Solo trabajadores (AccesoGate). Estado `guardando`, `error`.
- `confirmar`: `if (modulos.geolocalizacion) await obtenerPosicion()` (pide permiso una vez; ignora resultado) → `rpc("confirmar_aviso_control", { version: AVISO_CONTROL_VERSION })` → error: tr("No se pudo guardar. Inténtalo otra vez."); OK → `refrescar()` del Miembro (la gate lo deja pasar).
- Salir: signOut → `/`.
- Textos: tr("Antes de fichar"); párrafos: tr("Esta app registra tu") + «tr("hora de entrada y salida")» + tr("con el reloj del servidor, no con el del móvil."); trJsx("Cuando fichas, la app también comprueba si tu móvil está {dentro}. No guarda tu ubicación exacta ni te sigue en ningún otro momento — solo ese resultado (dentro/fuera) en el instante de fichar.", {dentro: tr("dentro o fuera de la obra")}); tr("Algunas obras tienen una") + tr("hora mínima para fichar la entrada") + tr(", para que no se pueda marcar la llegada antes de que empiece el turno."); tr("Al tocar «Lo he leído», el móvil te va a pedir permiso de ubicación. Acéptalo — así, cada vez que fiches, no hace falta pedirlo otra vez."); botón tr("Lo he leído") / tr("Guardando…"); tr("Cerrar sesión").
- Lección (:14-21): es un aviso informativo, no "consentimiento".
- **Discrepancia ACC-11**: el párrafo de ubicación y el de "te va a pedir permiso de ubicación" se muestran SIEMPRE, aunque el módulo `geolocalizacion` esté OFF (solo se condiciona la llamada a `obtenerPosicion`).

### components/landing/LandingMock.tsx (ACC-01)
- Cliente. `OBRAS_DEMO = ["Obra Marbella","Obra Centro","Obra Norte"]` (estas 3 no pasan por tr()). Estado `obra`, `picking`.
- Alto `h-[100dvh]`, `max-w-md`, `overflow-hidden` (:19-22: tarjeta del plano se encoge). Sin datos reales, sin llamadas.
- UI: Logo; botón-pastilla con la obra demo → Sheet tr("Elegir obra") con las 3 demo; enlace `/login` icono LogIn aria tr("Iniciar sesión"); tarjeta tr("Progreso de la obra"), "72%" fijo (literal), tr("Vista previa — inicia sesión para ver el progreso real"), `Sparkline [3,5,4,7,6,8,9]`; tarjeta tr("Plan de la obra") + tr("Vista de ejemplo — aquí verás el plano y las fotos de tu obra") + SVG decorativo propio; enlace `/login` tr("Inicia sesión para fichar, apuntar gastos y subir facturas").

### components/ui (en ámbito)
- **StampButton.tsx**: props `label,hora,color(green|orange),icon,onClick,disabled,pendiente`. `disabled` real = `disabled || marcado(!!hora) || pendiente` (:33-38: no re-fichar encima). Visual: marcado → borde/bg del color y `-rotate-1`; pendiente → amarillo + texto tr("Enviando…"); sin hora → "—:—". `disabled && !marcado && !pendiente` → opacity-40.
- **DayNav.tsx**: `esHoy = fecha === todayStr()`. Botones aria tr("Día anterior") / tr("Día siguiente") (siguiente `disabled` si `esHoy`); centro `fmtDateLong(fecha)`; si no es hoy: botón tr("Volver a hoy"). Usa `shiftDay`.
- **Sheet.tsx**: overlay `fixed inset-0 z-50`; click en fondo cierra; contenido `stopPropagation`; `max-h-[88vh]` con scroll; título + botón cerrar aria tr("Cerrar"). Sin Escape, sin focus-trap, sin `role=dialog`.
- **BarrasProgreso.tsx**: divs (no SVG, :6-8), `max = max(1, ...valores)`, altura `max(4, v/max*100)%` (suelo 4 %), color mezcla gris `[222,213,196]`→naranja `[242,133,27]` por posición; `aria-hidden`.
- **Sparkline.tsx**: SVG 100×32, gap 1.4, barras `max(2, v/max*h)`, última con opacidad 1, resto 0.55; gradiente `#D9963D→#F2851B` (id `obra-sparkline-gradient`).
- **NumeroGrande.tsx**: `entero = floor(valor)`, `resto = round((valor-entero)*10^dec)` con relleno a `dec` dígitos; separador decimal **"," fijo** (no sigue el locale); sufijo "%". Quirk: si el resto redondea a 100 (p.ej. 60,999) mostraría ",100".

---

## 4. Home — `app/(dashboard)/page.tsx` (HOM-*)

`InicioPage`: `esTrabajador ? <InicioTrabajador/> : <InicioGestor/>`.

### 4.1 InicioGestor (HOM-01…07)
Quién ve qué: `veDinero = rol==="dueno"||rol==="manager"` (:45); jefe de obra: sin Cobrado/Balance ni enlace a `/dinero`. `modulos.vehiculos` oculta tile "Coches hoy" y acceso Vehículos. `if (!obraActual) return null`.
Lecturas — un `useEffect` en `[obraActual, supabase, hoy, veDinero]` (al montar y al cambiar de obra; `hoy` se calcula en render, no se refresca a medianoche; NO escucha `obra:refrescar`), 6 consultas en `Promise.all`:
1. `fichajes` `.select("id",{count:"exact",head:true}).eq("obra_id",obra).eq("fecha",hoy).not("hora_entrada","is",null)` → `fichadosHoy = count ?? 0`.
2. `usos_vehiculo` `.select("vehiculo_id").eq("obra_id",obra).eq("fecha",hoy)` → `cochesHoy = new Set(vehiculo_id).size` (se ejecuta aunque el módulo esté OFF).
3. `gastos` `.select("importe,pagado_por,fecha").eq("obra_id",obra)` (todos los de la obra, sin paginar).
4. `cobros` `.select("importe").eq("obra_id",obra)` **solo si `veDinero`**; si no `{data: []}`.
5. `tareas` `.select("*").eq("obra_id",obra).order("orden").order("fecha_inicio")`.
6. `fichajes` `.select("fecha,hora_entrada,hora_salida").eq("obra_id",obra).gte("fecha", desdeGrafico)` donde `desdeGrafico = shiftDay(hoy, -13)` (sin tope superior).
Errores: ninguno se comprueba (se usa `data ?? []`); sin estado de carga (cifras "—" solo para fichados/coches; el resto pinta 0).
Cálculos cliente: `porDia` suma `minutosTrabajados` (sin cerrar = 0) por `fecha`; `serie` de 14 valores (de hoy-13 a hoy); `horasMes` = suma de las filas del mismo rango de 14 días cuya `fecha` cae en el mes actual (`monthBounds(currentMonth())`). `avance = avanceObraExacto(tareas)`; `rango = rangoObra(tareas)`; `retrasadas = tareas.filter(estadoTarea(t,hoy)==="retrasada").length`; `gastosMes = gastos.filter(fecha.slice(0,7)===mes)`; `gastado = suma(gastos)`; `balance = round((cobrado-gastado)*100)/100`; `presupuesto = suma(tareas.map(t=>({importe:t.presupuesto})))`; `pctPresupuesto = presupuesto>0 ? round(gastado/presupuesto*100) : 0`.
UI (textos exactos):
- Nombre de obra (+ `direccion`).
- Tarjeta portada: tr("Avance de la obra"); `NumeroGrande(avance)` (2 decimales); enlace circular `/planificacion` aria tr("Ver la planificación"); si `tareas.length===0`: enlace tr("Todavía no hay plan — añádelo o tráelo del Excel"); gráfico `BarrasProgreso(horasDia)` h-74 si algún valor>0, si no caja punteada tr("Sin horas fichadas estas dos semanas"); pie izquierda: etiqueta `rango ? tr("Fin previsto") : tr("Últimas 2 semanas")`, valor `rango ? fmtDate(rango.hasta) : tr("Horas fichadas")`; pie derecha: tr("Horas del mes"), `Math.round(horasMes/60) h`.
- Tarjeta Planificación (solo si `tareas.length>0 && rango`), enlace `/planificacion`: tr("Planificación"); `trN(n,"{n} capítulo","{n} capítulos")` · tr("hasta {fecha}",{fecha:fmtDate(rango.hasta)}) + si `retrasadas>0` " · " tr("{n} con retraso",{n}); `<MiniGantt tareas hoy>`.
- Tarjeta "Dinero de la obra" (enlace `veDinero ? "/dinero" : "/gastos"`): tr("Dinero de la obra"); si `veDinero`: tres `Cifra` con etiquetas **literales sin tr()**: "Cobrado" (`fmtEURCorto(cobrado)`), "Gastado" (`fmtEURCorto(gastado)`), "Balance" (`"+"` si ≥0 + `fmtEURCorto(balance)`, verde si ≥0 si no rojo); si no: `Cifra` tr("Gastado en total") con `fmtEUR(gastado)` (con céntimos). Pie: trJsx("Este mes: {importe}") con `fmtEUR(suma(gastosMes))`; si `pagadoPorMi(gastosMes)>0` " · " trJsx("pagado por ti {importe}") (amarillo). Si `presupuesto>0`: tr("Presupuesto {importe}",{importe:fmtEURCorto(presupuesto)}), tr("{pct}% gastado",{pct}) (rojo y barra roja si >100; barra `min(100,pct)%`).
- Tiles: tr("Fichados hoy") (`—` mientras null); si `modulos.vehiculos` tr("Coches hoy"); grid 2 cols si vehículos ON, si no 1.
- Accesos rápidos: tr("Fichajes") (clave literal "Fichajes"), Vehículos (si módulo), "Gastos", "Dinero" (solo `veDinero`) — etiquetas por `tr(a.label)`.
Discrepancias:
- **HOM-03 "Horas del mes" incorrecto**: se calcula solo con las filas de los últimos 14 días (`:93`), así que a partir del día 15 del mes subcuenta (y los 1ºs días del mes ignora los días del mes anterior, correcto). SPEC dice "Horas del mes" (suma del mes).
- HOM-05: etiquetas "Cobrado/Gastado/Balance" sin tr() (SPEC §20.3 ya lo dice).
- HOM-05: SPEC dice cifras "whole euros"; el jefe ve "Gastado en total" con `fmtEUR` (céntimos) — código gana.
- SHL-07: Home no se refresca con pull-to-refresh.
- HOM-06 "Fichados hoy" cuenta filas con entrada hoy en esta obra (coincide).
- `gastado` incluye gastos `pagado_por="personal"` (HOM-05 coherente con Q-01: cobrado − gastado).

### 4.2 `components/inicio/InicioTrabajador.tsx` (HOM-W1…W5)
Lecturas:
- `cargar` (en `[trabajadorId, jornadaHoras]`; **no** depende de obra; **no** escucha `obra:refrescar`); `if (!trabajadorId) return`. `Promise.all`:
  - `fichajes` `.select("*").eq("trabajador_id",id).eq("fecha",todayStr()).limit(1)` → `hoyFichaje = data[0] ?? null`. **Sin filtro de obra ni orden**: con varias obras hoy, la entrada/salida mostrada es la de una fila arbitraria.
  - `fichajes` `.select("hora_entrada,hora_salida").eq("trabajador_id",id).gte("fecha",desde).lt("fecha",hasta)` (mes actual, todas las obras) → `totalesFichajes(filas, jornadaHoras)`; `dias = filas.length` (incluye filas sin horas — Q-06).
- `useEffect [obraActual]`: `rpc("avance_obra",{o_id: obraActual.id})` → `avance = typeof data==="number" ? data : null` (si la RPC devuelve string/numeric serializado, el bloque no se mostraría; **unclear**).
UI: nombre+dirección de obra; si `avance != null`: tarjeta tr("Avance de la obra") + `NumeroGrande`; `HeroStatCard` label tr("Mis horas · {mes}",{mes:monthLabel(currentMonth())}), valor `fmtHoras(mes.trabajados)`, sub `extra>0 ? tr("{horas} extra",{horas}) : tr("Total del mes")`; tiles tr("Entrada") (`hora_entrada || "—"`), tr("Salida"), tr("Días"); CTA a `/fichajes`: `entrada && !salida` → tr("Marcar mi salida"); `entrada` (con salida) → tr("Mis horas de hoy"); si no tr("Marcar mi entrada").
Discrepancias: sub-texto del hero aquí es tr("{horas} extra") pero en fichajes es tr("{horas} extra este mes") (distintos). Home trabajador sin `trabajador_id` muestra ceros y CTA "Marcar mi entrada" sin aviso (la pantalla `/fichajes` sí tiene "Falta un paso").

---

## 5. Fichajes — `app/(dashboard)/fichajes/page.tsx`

`FichajesPage`: `esTrabajador ? <MiFichaje/> : <FichajesCuadrilla/>`.

### 5.1 FichajesCuadrilla (gestores; FIC-10…FIC-16, FIC-20…24)
Quién ve qué: `esDueno` → botón "Corregir horas", sheet, hint de otros días en versión dueño; `modulos.transporte` → línea de transporte; botones Entrada/Salida solo activos si `esHoy`; "Añadir trabajador" visible para **todos** los gestores (SPEC FIC-15/§20.2). Sheet de corrección solo `corrigiendo && esDueno`.
Estado: `fecha` (init `todayStr()`), `error`, `corrigiendo`, `trabajadores`, `fichajes`, `fichajesOtrasObras`, `addingWorker`, `nuevoNombre`, `ubicacionSheet`, `cambiandoObra`.
Lecturas:
- Mount (una vez; no se refresca con pull ni cambio de obra/día): `trabajadores` `.select("*").eq("activo",true).order("nombre")` (toda la empresa por RLS, no filtra por obra).
- `cargarFichajes` (al montar y cuando cambian `obraActual`/`fecha`; y en `obra:refrescar`): en paralelo `fichajes` `.select("*").eq("obra_id",obra).eq("fecha",fecha)` y `fichajes` `.select("*").neq("obra_id",obra).eq("fecha",fecha)` (todas las otras obras visibles por RLS). Errores ignorados (`data ?? []`).
- `otrasObrasDe(tid)`: de `fichajesOtrasObras` filtra `trabajador_id` y `hora_entrada` truthy; mapea a `obras` del contexto (incluye cerradas); tocar → `setObraId`.
Escrituras (todas `from("fichajes").upsert(..., {onConflict:"obra_id,trabajador_id,fecha"}).select().single()` salvo indicado):
- `marcar(tid, campo)` (Entrada/Salida): payload `{obra_id, trabajador_id, fecha, [campo]: nowHHMM()}` (hora del teléfono; el servidor la sustituye salvo dueño, FIC-02). Éxito → `ponerEnLista(data)` (muestra lo devuelto). `esFalloDeRed(err)` → `encolar({obraId,trabajadorId,fecha,campo,hora})` (sin ubicación). Otro error → `setError(err.message)` (texto crudo de la BD, p.ej. "La entrada ya está fichada. Solo el dueño puede cambiarla."). Sin geovalla en la cuadrilla (FIC-07: solo vista trabajador).
- `guardarCorreccion(tid, entrada, salida)`: payload `{obra_id, trabajador_id, fecha, hora_entrada, hora_salida, hora_corregida:true}`; `!obraActual` → tr("No hay obra elegida."); error → devuelve `err.message` (se enseña dentro del sheet); éxito → `ponerEnLista` + `setCorrigiendo(null)` (cierra sheet).
- `moverObra(tid, nuevaObraId)`: `!registro` → tr("No hay nada que mover todavía."); misma obra → `null`; `from("fichajes").update({obra_id: nuevaObraId}).eq("id", actual.id).select().single()`; error → `err.message`; éxito → quita el fichaje de `fichajes`. El historial lo escribe un trigger AFTER (FIC-09).
- `guardarUbicacion(tid, ubicacion)`: upsert `{obra_id, trabajador_id, fecha, ubicacion}`; **sin tratamiento de error** (el sheet se cierra siempre); puede crear una fila sin horas (FIC-06 "no ghost rows" — aquí no se evita; ver también MiFichaje).
- `anadirTrabajador`: `auth.getUser()`; `from("trabajadores").insert({ owner_id: user.id, nombre: nuevoNombre.trim() }).select().single()`; éxito → añade y reordena con `localeCompare`; sin mensaje de error; cierra el formulario siempre.
Reglas cliente:
- Salida deshabilitada si `!esHoy || (!r?.hora_entrada && !pendienteDe(t.id,"hora_entrada"))`; Entrada `disabled={!esHoy}`; StampButton añade `marcado`/`pendiente`.
- Total diario `minutosTrabajados`; pill `+{horas} extra` si `minutosExtra>0` (jornada del contexto).
- Insignias: si `hora_corregida || confirmado_trabajador === false`: "Horas corregidas por el dueño" (si corregida) y `Confirmado`/`Sin confirmar` (según `confirmado_trabajador`). `ubicacion_ok === false` → "Fichó fuera de la obra" + ` (a {m} m)` si `distancia_metros != null`.
- Línea transporte: `modulos.transporte` y `textoTransporte`: `propio` → tr("Vino en su coche"); `traido` → tr("Le trajo {nombre}") o tr("Le trajeron").
- Banner offline (todas las pendientes del móvil, sin filtrar por obra/día): `trN(n,"Sin conexión: {n} fichaje en cola, se enviará solo en cuanto vuelva la señal.","Sin conexión: {n} fichajes en cola, se enviarán solos en cuanto vuelva la señal.")`.
- `ponerEnLista` inserta/actualiza por `id` sin comprobar que el fichaje sea de la obra/día mostrados (los reintentos de la cola pueden colar filas de otra obra/día; **quirk**, :106-113).
Textos exactos: DayNav; botón obra tr("Fichando en") + nombre + tr("Cambiar"); hint no-hoy: dueño tr("Otro día: toca «Corregir horas» en quien haga falta."), resto tr("Las horas de otros días solo las puede cambiar el dueño."); error banner = mensaje crudo; vacío `Empty` title tr("Todavía no hay trabajadores") sub tr("Añade el primero para empezar a fichar."); por trabajador: nombre, tr("También hoy en:"), botón zona tr("Añadir zona/tarea") (sin espacios alrededor de "/", **distinto** de MiFichaje "Añadir zona / tarea"), tr("Entrada"), tr("Salida"), tr("Corregir horas"); añadir: tr("Añadir trabajador"), placeholder tr("Nombre del trabajador"), tr("Cancelar"), tr("Añadir"); sheets: tr("Fichar en qué obra") (ObraPicker), tr("Zona / tarea") (UbicacionForm: Field tr("Dónde trabajó / qué tarea hizo"), placeholder tr("Ej. Planta 2 — demolición tabiquería"), botón tr("Guardar")), tr("Corregir horas").
Carga: sin spinner; el estado "Todavía no hay trabajadores" parpadea mientras carga la primera lectura (`trabajadores=[]` inicial).

### 5.2 CorregirHorasForm (dueño; FIC-20…FIC-24)
Props: nombre, fecha, entrada, salida, fichajeId, obraId, otrasObras (= obras activas distintas de la del registro), nombreObra, onGuardar, onMoverObra.
Lectura: al montar/`fichajeId` cambia: `fichajes_historial` `.select("*").eq("fichaje_id",fichajeId).order("cambiado_en",{ascending:false})`; sin `fichajeId` → `[]`. No se relee tras guardar (el sheet se cierra); si "Mover" tiene éxito, el sheet permanece abierto con mensaje.
Estado: `e`,`s` (inicial = horas actuales o ""), `guardando`, `error`, `confirmandoQuitar`, `historial`, `moviendo`, `nuevaObra`, `errorMover`, `movidoA`.
Reglas:
- `min = minutosTrabajados(e||null, s||null)`; `vacio = !e && !s`; `problema` = `s && !e` → tr("Pon también la hora de entrada."); `e && s && min===null` → tr("La salida tiene que ser después de la entrada."). Guardar deshabilitado si `problema || vacio || guardando` (:498-503 lección: no crear fichajes vacíos).
- Cada input `type="time"` tiene botón × (aria tr("Quitar la hora de entrada") / tr("Quitar la hora de salida")) visible solo si hay valor (:583-585 lección iOS).
- Guardar: `onGuardar(e||null, s||null)` (guardarCorreccion).
- Quitar día: dos pasos; visible solo si `entrada || salida`. Paso 1 botón tr("Quitar este día (no vino)"); paso 2 botón tr("Toca otra vez: {nombre} no cuenta este día") → `guardar(null,null)` (upsert con ambas horas `null` y `hora_corregida:true`; salta la regla `vacio`). `confirmandoQuitar` no se resetea tras fallo (se mantiene el paso 2).
- Mover: bloque visible si `fichajeId && obraId && otrasObras.length>0`: tr("¿Fichado en la obra equivocada?"); Select con opción tr("Elige la obra correcta…"); botón `nuevaObra ? tr("Mover a {obra}") : tr("Elige una obra arriba")`; éxito → tr("Movido a {obra}. Ya puedes cerrar esta ventana.") (nombre de la obra o tr("otra obra")); error → texto crudo bajo el botón.
- Textos restantes: cabecera `{nombre} · {fmtDateLong(fecha)}`; tr("Fichado ahora:") `{entrada ?? "—"} → {salida ?? "—"}` si hay alguna; total tr("En total:") + `fmtHoras(min)`; aviso tr("Quedará marcado como «corregido por el dueño», en tu móvil y en el suyo."); error inline (rojo); botón tr("Guardar horas") (con spinner); historial: tr("Historial de cambios"); línea de obra: trJsx("Movido de {antes} a {despues}") (`nombreObra()` con respaldo tr("otra obra")), línea de horas: `{antes_e ?? "—"} → {antes_s ?? "—"}` + tr(" pasó a ") + `{despues_e ?? "—"} → {despues_s ?? "—"}`; sufijo " · " + `fmtCambio(h.cambiado_en)` (= `toLocaleString("es-ES", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})`, **locale fijo es-ES**, :697-698; SPEC §20.3).
- Discrepancias: SPEC FIC-20 pone el nombre y la fecha como "header"; en el código el título del Sheet es tr("Corregir horas") y nombre+fecha van en el cuerpo. El historial se muestra DESPUÉS del botón Guardar (SPEC no fija el orden). No hay estado "cargando" del historial.

### 5.3 MiFichaje (trabajador; FIC-30…38) — `components/fichajes/MiFichaje.tsx`
Quién ve qué: solo trabajadores. `trabajadorId = miembro.trabajador_id`; si falta → pantalla "Falta un paso" (icono UserX): tr("Falta un paso"), tr("El dueño todavía no ha enlazado tu cuenta con tu ficha de trabajador. En cuanto lo haga, podrás fichar tus horas desde aquí."). Línea de transporte solo `esHoy && modulos.transporte`. Geovalla solo `modulos.geolocalizacion` y obra con lat/lng.
Estado: `fecha`, `fichaje`, `mes {trabajados, extra}`, `cambiandoObra`, `editandoTarea`, `error`.
Lecturas (`cargar`, deps `[obraActual, trabajadorId, fecha, jornadaHoras]`: al montar, al cambiar obra o día, y en `obra:refrescar`; se ejecuta también tras `guardar` y tras un fichaje exitoso):
- `fichajes` `.select("*").eq("obra_id",obra).eq("trabajador_id",id).eq("fecha",fecha).maybeSingle()`.
- `fichajes` `.select("hora_entrada,hora_salida").eq("trabajador_id",id).gte("fecha",desde).lt("fecha",hasta)` (mes actual, todas las obras; :408 lección). `totalesFichajes(…, jornadaHoras)`.
- Cola offline: `useFichajesPendientes(supabase, onConfirmado)`; `onConfirmado` hace `setFichaje(prev => prev && prev.id===data.id ? data : prev ?? data)`.
- `pendienteEntrada/Salida`: algún pendiente con mismo `trabajadorId`, `fecha` y `campo` (no filtra por obra).
Escrituras:
- `fichar(campo)`: `hora = nowHHMM()` (antes de esperar GPS); si `modulos.geolocalizacion && obra.lat!=null && obra.lng!=null` → `obtenerPosicion()` (high accuracy, timeout 8000 ms, maximumAge 0; **la petición de fichaje espera hasta 8 s**); con posición: `distancia = distanciaMetros(obra.lat,obra.lng,pos.lat,pos.lng)` (Haversine, R=6371000, redondeado), `ubicacionOk = distancia <= obra.radio_metros` (sin fallback 150 en cliente; depende de la columna). Upsert `{obra_id, trabajador_id, fecha, [campo]: hora, ubicacion_ok, distancia_metros}` (los dos últimos siempre presentes, `null` si no hay dato → **la salida sobrescribe la geovalla de la entrada**, y un fichaje sin GPS la borra a `null`). Éxito → `setFichaje(data)` + `cargar()`. `esFalloDeRed` → `encolar({..., ubicacionOk, distanciaMetros})`. Otro error → `setError(err.message)` (crudo, p.ej. "La entrada ya está fichada. Solo el dueño puede cambiarla.", "Todavía no puedes fichar: el turno empieza a las …"). No hay validación cliente de hora mínima del turno (FIC-04 solo en BD).
- `guardar(campos)` (Confirmo, zona, transporte): upsert `{obra_id, trabajador_id, fecha, ...campos}` mismo onConflict; error → `setError(err.message)`; `setFichaje(data)` si hay; siempre `cargar()` después. Puede crear fila sin horas (zona/transporte antes de fichar; FIC-06).
  - "Confirmo": `guardar({confirmado_trabajador:true})`; zona: `guardar({ubicacion: v})` + cierra sheet; transporte: `guardar({transporte, traido_por})`.
Reglas cliente:
- `minutos = minutosTrabajados(...)`, `extra = minutosExtra(minutos, jornadaHoras)`.
- Hoy: `StampButton` Entrada (`pendiente={pendienteEntrada}`) y Salida (`disabled={!fichaje?.hora_entrada && !pendienteEntrada}`, `pendiente={pendienteSalida}`). No hoy: `HoraFija` (label tr("Entrada")/tr("Salida"), `hora || "—"`).
- Botón de zona: `onClick={() => esHoy && setEditandoTarea(true)}` — se muestra también en otros días pero no hace nada (SPEC FIC-36 "today only").
- Bloque corrección: visible si `hora_corregida || confirmado_trabajador === false`. Badge si `hora_corregida`. Caja "Confirmo" si `!confirmado_trabajador` (también aparece con `confirmado_trabajador` null aunque no sea corregida si la otra condición se cumple; SPEC FIC-34 dice "corrected and unconfirmed").
Textos exactos: Hero tr("Mis horas · {mes}") valor `fmtHoras(mes.trabajados)` sub `extra>0 ? tr("{horas} extra este mes") : tr("Total del mes")`; botón de obra tr("Estoy en") + nombre + tr("Cambiar"); error banner crudo; offline tr("Sin conexión: tu fichaje está guardado en el móvil y se enviará solo en cuanto vuelva la señal."); total `fmtHoras` + tr("+{horas} extra"); tr("Horas corregidas por el dueño"); trJsx("Quedó así: {horas}. ¿Está bien?") con `{entrada ?? "—"} → {salida ?? "—"}`; botón tr("Confirmo"); zona: `fichaje.ubicacion` o tr("Añadir zona / tarea"); no-hoy: tr("Solo puedes fichar el día de hoy. Si falta algo de otro día, díselo al jefe."); sheets: tr("¿En qué obra estás?") (ObraPicker), tr("Zona / tarea") con `TareaForm` (Field tr("¿Dónde has trabajado hoy?"), placeholder tr("Ej. Planta 2 — tabiquería"), botón tr("Guardar")).
- Discrepancia FIC-36: SPEC llama "sheet «¿Dónde has trabajado hoy?»"; en código ese texto es el label del campo, el título del sheet es "Zona / tarea".
- Discrepancia FIC-33: el banner offline del trabajador no cuenta "N" (es un texto fijo); la cuadrilla sí cuenta.

### 5.4 TransporteSelector (FIC-37) — `components/fichajes/TransporteSelector.tsx`
- Props `transporte`, `traidoPor`, `onGuardar(transporte, traidoPor)`. Sin lecturas.
- Opciones: tr("En mi coche") → `onGuardar("propio", null)`; tr("Me trajeron") abre el sheet (no guarda aún). Si `transporte==="traido"` botón secundario: `traidoPor ? tr("Le trajo {nombre} · cambiar") : tr("Decir quién te trajo")`.
- Sheet tr("¿Quién te trajo?"): Field tr("Nombre") placeholder tr("Ej. Mi hermano, un compañero…"), botón tr("Ok") → `onGuardar("traido", quien.trim() || null)` (permite nombre vacío). Título de la tarjeta: tr("¿Cómo has llegado?").
- Export `textoTransporte(transporte, traidoPor)`: tr("Vino en su coche"), tr("Le trajo {nombre}"), tr("Le trajeron"), `null`.
- Lección (:77-80): ventana aparte para que el teclado no tape el botón (T-08).
- Obs: `quien` se inicializa una vez con `traidoPor` y no se resincroniza.

---

## 6. Librerías de apoyo

### lib/offline-fichajes.ts (FIC-08)
- Tipo `FichajePendiente {id, obraId, trabajadorId, fecha, campo, hora, ubicacionOk?, distanciaMetros?, creadoEn}`. Clave `localStorage["obra_fichajes_pendientes"]` (JSON array). Lectura/escritura con try/catch (almacenamiento lleno/privado: se pierde la cola, no la app; :38-41).
- `esFalloDeRed(error)`: `false` si no hay error; `true` si `navigator.onLine === false`; si no, mensaje en minúsculas incluye "fetch", "network" o "load failed".
- `useFichajesPendientes(supabase, onConfirmado)` → `{pendientes, encolar}`:
  - `encolar` añade con `crypto.randomUUID()` y `Date.now()`; escribe en localStorage **dentro del updater** de setState.
  - `reintentarUno`: `from("fichajes").upsert({obra_id, trabajador_id, fecha, [campo]: hora, ...(ubicacionOk!==undefined?{ubicacion_ok}:{}), ...(distanciaMetros!==undefined?{distancia_metros}:{})}, {onConflict:"obra_id,trabajador_id,fecha"}).select().single()`. Éxito → `onConfirmado(data)`, resuelto. Error cuyo mensaje cumple `/ya está fichad/i` → `from("fichajes").select("*").eq("obra_id").eq("trabajador_id").eq("fecha").maybeSingle()`; si hay fila → `onConfirmado`; resuelto (:103-104 lección). Otro error: resuelto = `!esFalloDeRed(error)` → **un error de negocio descarta el item de la cola sin avisar al usuario**; un fallo de red lo deja.
  - `reintentarTodos`: candado `reintentando` (ref); lee la cola de localStorage (no del estado), procesa secuencialmente, escribe los que quedan y actualiza estado. Disparadores: evento `window` "online", `setInterval(…, 20000)` y una llamada inmediata al montar.
- Observaciones: la cola no está ligada al usuario (un móvil compartido reintentaría items de otro; RLS los rechazaría y se descartarían); no se limpia al cerrar sesión; la `hora` encolada se envía pero el servidor la reemplaza (Q-02).

### lib/horas.ts (FIC-03)
- `minutosTrabajados(entrada, salida)`: `null` si falta alguno, no parsea, o `salida <= entrada`; si no `s - e` (sin descontar comida; :4-6).
- `minutosExtra(min, jornadaHoras)` = `max(0, min - round(jornadaHoras*60))`, 0 si `min===null`.
- `fmtHoras(min)`: `null → "—"`, `"{h}h"` si m=0, si no `"{h}h {m}m"` (**sin** pasar por tr()).
- `totalesFichajes(lista, jornada)` → `{trabajados, extra, sinCerrar}`; `sinCerrar++` si hay entrada y `min===null` (incluye también salida ≤ entrada).
- Nota: el parseo no valida rango (`"25:00"` valdría).

### lib/geo.ts (FIC-07)
- `distanciaMetros(lat1,lng1,lat2,lng2)`: Haversine R=6371000, `Math.round`.
- `obtenerPosicion()`: `Promise<GeolocationPosition|null>`; sin `navigator.geolocation` → `null`; `getCurrentPosition(ok, ()=>resolve(null), {enableHighAccuracy:true, timeout:8000, maximumAge:0})`. No guarda coordenadas (:13-17).

### lib/format.ts
- `todayStr()`/`nowHHMM()`: hora **local del dispositivo** (no `Europe/Madrid`; SPEC FIC-02 habla de Madrid solo para el servidor). `fmtDate` = `dd/mm/yyyy` fijo; `fmtDateLong` (weekday long + day + month long, mayúscula inicial, `localeActual()`); `fmtEUR`, `fmtEURCorto` (0 decimales) con `Intl.NumberFormat(localeActual(),{style:"currency",currency:"EUR"})`; `currentMonth`, `monthLabel` (month long + year, locale), `shiftMonth`, `monthBounds(mes)` → `{desde:"YYYY-MM-01", hasta:"<mes siguiente>-01"}` (usar `gte/lt`; :60-65 lección: `${mes}-32` falla en Postgres), `shiftDay` (aritmética de Date local), `weekdayShort`.
- Lección :4-11: `toISOString()` pasa a UTC y rompe el "día siguiente/anterior"; por eso `aISO` manual.

---

## 7. Resumen de textos de estado (claves i18n críticas)
Ver cada sección; las que NO pasan por tr(): etiquetas "Cobrado"/"Gastado"/"Balance" (page.tsx:251-256), `OBRAS_DEMO` y "72%" (LandingMock), `fmtHoras` ("h"/"m"/"—"), `fmtCambio` locale es-ES, `global-error.tsx` (trilingüe fijo), `metadata` (title/description del layout).

## 8. Lecciones en comentarios (file:line)
- `lib/format.ts:4-11` — no usar `toISOString()` para fechas locales (UTC desplaza el día).
- `lib/format.ts:60-65` — `monthBounds` con `gte/lt`; `${mes}-32` rechazado por Postgres.
- `components/ui/StampButton.tsx:33-37` — una hora fichada no se vuelve a fichar; pendiente tampoco (evita duplicar).
- `lib/offline-fichajes.ts:44-46` — solo fallos de red se encolan; errores de negocio se muestran.
- `lib/offline-fichajes.ts:103-104` — "ya está fichad" = el primer intento sí llegó: traer valor real y parar.
- `lib/offline-fichajes.ts:38-41` — almacenamiento lleno/privado: se pierde la cola, no la app.
- `components/fichajes/TransporteSelector.tsx:77-80` — sheet aparte para que el teclado no tape el botón.
- `app/(dashboard)/fichajes/page.tsx:60-61, 95-98` — otras obras del mismo día con enlace para saltar (si no, las horas "se pierden").
- `app/(dashboard)/fichajes/page.tsx:123-124` — la hora que vale es la del servidor; mostrar lo que devuelve.
- `app/(dashboard)/fichajes/page.tsx:498-503 (CorregirHorasForm)` — no crear fichaje vacío; `:583-585` — × por input (iOS no deja vacío).
- `components/fichajes/MiFichaje.tsx:408` — del mes cuentan TODAS las obras.
- `lib/miembro-context.tsx:56-58` — filtrar `miembros` por `user_id`; `:65-67` — `empresas` se lee aparte de `mi_empresa_id()`.
- `lib/obra-context.tsx:92-96` — respetar la obra elegida en sesión aunque esté cerrada; arranque en frío prefiere activa.
- `lib/supabase/middleware.ts:4-7` — `/` por igualdad exacta; `:11-14` — `/reset-password` no redirige con sesión.
- `public/sw.js:4-8` — no cachear navegaciones.
- `components/layout/DashboardShell.tsx:20-24` — `min-w-0` evita desbordamiento lateral en iPhone.
- `components/layout/TopBar.tsx:22-23, 26` — safe-area superior; logo siempre a Inicio.
- `lib/nav.ts:22-23, 37-39, 57-59` — barra inferior/planificación fuera en móvil; jefe sin Dinero.
- `components/layout/AccesoGate.tsx:33-34` — el admin de plataforma no espera aprobación.
- `components/layout/AvisoControl.tsx:14-21, 31-33` — aviso informativo (no consentimiento); permiso de ubicación una sola vez.
- `components/landing/LandingMock.tsx:19-22` — 100dvh sin scroll, tarjeta del plano elástica.
- `components/ui/BarrasProgreso.tsx:6-8, 37-38` — divs en vez de SVG; suelo del 4 %.
- `components/ui/NumeroGrande.tsx:3-5` — los decimales son reales.
- `app/layout.tsx:49-52, 56-58` — viewport-fit cover; force-dynamic.
- `app/(dashboard)/page.tsx:174, 184-185` — mensaje si no hay plan / sin horas (evitar "0" o raya plana sin explicar).

## 9. Discrepancias código vs SPEC (el código gana)
| # | Dónde | SPEC | Qué hace el código |
|---|---|---|---|
| 1 | `page.tsx:93` (Home), `:108-109` | HOM-03 "Horas del mes" | La suma sale solo de las filas de los últimos 14 días → subcuenta desde el día 15 del mes. |
| 2 | `InicioTrabajador.tsx:35-40,49` | HOM-W4 Entrada/Salida de hoy | Lee `fichajes` de hoy **sin filtrar obra ni orden** (`limit(1)`); con 2 obras muestra una arbitraria; el CTA depende de ella. |
| 3 | `page.tsx` Home / `InicioTrabajador` | SHL-07 pantallas se refrescan con `obra:refrescar` | Home (ambas variantes) no escucha el evento. |
| 4 | `MiFichaje.tsx:467-481`, `page.tsx:125-132` | FIC-07 geovalla "al fichar" | Solo en vista trabajador; la cuadrilla nunca envía `ubicacion_ok`/`distancia_metros`. En trabajador cada fichaje (también Salida) sobrescribe la pareja, borrándola a `null` si no hay GPS. |
| 5 | `AvisoControl.tsx:68-83` | ACC-11 texto de ubicación "si el módulo está ON" | Párrafos de ubicación y de permiso siempre visibles; solo `obtenerPosicion()` depende del módulo. |
| 6 | `offline-fichajes.ts:117` | FIC-08 "errores de negocio se muestran" | En la cola, un error de negocio se descarta en silencio (no se muestra). |
| 7 | `MiFichaje.tsx:619-627` | FIC-36 zona/tarea "today only" | Botón visible en otros días (inerte). Título del sheet "Zona / tarea"; "¿Dónde has trabajado hoy?" es el label. |
| 8 | `MiFichaje.tsx:563-570` | FIC-34 corregida y sin confirmar | Caja "Confirmo" aparece si `confirmado_trabajador` es falsy aunque `hora_corregida` sea false y la otra rama (`=== false`) se cumpla. |
| 9 | `page.tsx` (cuadrilla) :196-208, MiFichaje:428-444 | FIC-06 nunca filas fantasma | Zona/transporte/ubicación pueden crear fila sin horas; solo el sheet de corrección evita el vacío. |
| 10 | `fichajes/page.tsx:396-408` | FIC-15 / §20.2 | Añadir trabajador visible a todos los gestores; inserta con `owner_id`; sin mensaje de error. |
| 11 | `TopBar.tsx:49-57` | SHL-03 atajo a Resumen | Se muestra en móvil y escritorio (el sidebar ya lo tiene). |
| 12 | `ObraPicker.tsx:44-50`, `SinObras.tsx` | SHL-04/06 | "Nueva obra" para todos los roles; `crearObra` falla en silencio (picker/form sin mensaje). |
| 13 | `obra-context.tsx:91-105` | SHL-08 | Un error de lectura de `obras` equivale visualmente a "sin obras" (crea tu primera obra / sin obra asignada). |
| 14 | `SuscripcionInactiva.tsx:39` | ACC-14 "logout en cada gate" | Etiqueta "Salir" (resto "Cerrar sesión"); Sidebar sale a `/login`, las gates a `/`. |
| 15 | `fichajes/page.tsx:68-75` | FIC-14 lista de trabajadores | Se carga una vez; pull-to-refresh y cambio de obra no la actualizan; sin estado de carga (parpadea "Todavía no hay trabajadores"). |
| 16 | `fichajes/page.tsx:256-261` | FIC-13 "N fichaje(s) en cola" | Cuenta todas las pendientes del móvil, no solo obra/día mostrados. |
| 17 | `format.ts:15-20` | FIC-02 servidor Europe/Madrid | `fecha` y hora de cliente = zona del dispositivo; solo la BD usa Madrid. |
| 18 | `NumeroGrande.tsx:17-19` | HOM-02 "dos decimales" | Separador "," fijo; posible ",100" por redondeo. |
| 19 | `nav.ts` / `AccesoGate.tsx:25-27` | §2 rutas bloqueadas | El bloqueo por rol solo cubre al trabajador; jefe de obra y `/dinero` no se bloquean en AccesoGate (lo decide la página, fuera de ámbito). |
| 20 | `app/error.tsx:10`, `global-error.tsx:11` | PLT-03 | Prop `retry` (nombre posiblemente distinto en Next 16). Unclear. |
| 21 | `public/sw.js:23-42` | PLT-02 "static GETs" | Cachea cualquier GET same-origin no-navegación (incluye `/api/*`, RSC). |
| 22 | `app/layout.tsx:27-30` | PLT-01 i18n total | `metadata.description` español fijo. |
| 23 | `ajustes` upserts (obra-context :64-67, :77-80; miembro-context :93-95) | §17 ajustes una fila por empresa | Upsert `{owner_id,…}` sin `onConflict`; unclear cómo resuelve la fila de empresa (probablemente PK/trigger en BD). |

---

## Data-access methods needed
Notación: `fn(args)` → llamada exacta del v1. `RLS` decide el alcance. Todos con cliente Supabase del navegador salvo `getUser`-proxy.

### Sesión / permisos / empresa
1. `getSession()` → `auth.getSession()` (+ `onAuthStateChange(cb)`) — useSession.
2. `getUser()` → `auth.getUser()` — Miembro, writes que necesitan `user.id`.
3. `signOut()` → `auth.signOut()`.
4. `getMiembro(userId)` → `from('miembros').select('*').eq('user_id', userId).maybeSingle()`.
5. `soyAdminPlataforma()` → `rpc('soy_admin_plataforma')` (truthy = admin).
6. `getEstadoSuscripcion()` → `from('empresas').select('activa_hasta, bloqueada').maybeSingle()` (independiente de `mi_empresa_id()`).
7. `getAjustes()` → `from('ajustes').select('*').limit(1).maybeSingle()` (módulos: `mod_vehiculos|notas_voz|caja_jefe|transporte|geolocalizacion`; también `jornada_horas`, `jefe_ve_todas`).
8. `getAjustesJornada()` → `from('ajustes').select('jornada_horas,jefe_ve_todas').maybeSingle()`.
9. `guardarJornada(horas)` → `from('ajustes').upsert({owner_id:user.id, jornada_horas:horas, updated_at:ISO})`.
10. `guardarJefeVeTodas(valor)` → `from('ajustes').upsert({owner_id:user.id, jefe_ve_todas:valor, updated_at:ISO})`.
11. `guardarModulo(clave, valor)` → `from('ajustes').upsert({owner_id:user.id, ['mod_'+clave]:valor, updated_at:ISO})`.
12. `guardarMiNombre(nombre)` → `rpc('guardar_mi_nombre', {nuevo:nombre})`.
13. `confirmarAvisoControl(version)` → `rpc('confirmar_aviso_control', {version})` (versión `"2026-09-28"`).

### Obras
14. `listarObras()` → `from('obras').select('*').order('created_at',{ascending:false})`.
15. `crearObra(nombre, direccion)` → `from('obras').insert({owner_id:user.id, nombre, direccion: direccion||null, activa:true}).select().single()`.
16. `cambiarActivaObra(id, activa)` → `from('obras').update({activa}).eq('id',id).select().single()` (el v1 invierte `!obra.activa`).
17. `avanceObra(obraId)` → `rpc('avance_obra', {o_id:obraId})` (devuelve número).

### Fichajes — lectura
18. `fichajesDelDia(obraId, fecha)` → `from('fichajes').select('*').eq('obra_id',obraId).eq('fecha',fecha)`.
19. `fichajesDelDiaOtrasObras(obraId, fecha)` → `from('fichajes').select('*').neq('obra_id',obraId).eq('fecha',fecha)`.
20. `miFichajeDelDia(obraId, trabajadorId, fecha)` → `from('fichajes').select('*').eq('obra_id',…).eq('trabajador_id',…).eq('fecha',…).maybeSingle()`.
21. `fichajeDeHoyDeTrabajador(trabajadorId, fecha)` → `from('fichajes').select('*').eq('trabajador_id',…).eq('fecha',fecha).limit(1)` (Home trabajador; sin filtro de obra).
22. `horasDelMesDeTrabajador(trabajadorId, desde, hasta)` → `from('fichajes').select('hora_entrada,hora_salida').eq('trabajador_id',…).gte('fecha',desde).lt('fecha',hasta)`.
23. `contarFichadosHoy(obraId, fecha)` → `from('fichajes').select('id',{count:'exact',head:true}).eq('obra_id',…).eq('fecha',fecha).not('hora_entrada','is',null)`.
24. `fichajesUltimosDias(obraId, desdeFecha)` → `from('fichajes').select('fecha,hora_entrada,hora_salida').eq('obra_id',…).gte('fecha',desdeFecha)`.
25. `fichajeActual(obraId, trabajadorId, fecha)` (reconciliación offline) → `from('fichajes').select('*').eq('obra_id').eq('trabajador_id').eq('fecha').maybeSingle()`.
26. `historialFichaje(fichajeId)` → `from('fichajes_historial').select('*').eq('fichaje_id',fichajeId).order('cambiado_en',{ascending:false})`.

### Fichajes — escritura (todas `onConflict:'obra_id,trabajador_id,fecha'`, `.select().single()`)
27. `ficharCampo(obraId, trabajadorId, fecha, campo('hora_entrada'|'hora_salida'), hora)` (cuadrilla) → `upsert({obra_id,trabajador_id,fecha,[campo]:hora})`.
28. `ficharConGeovalla(obraId, trabajadorId, fecha, campo, hora, ubicacionOk|null, distanciaMetros|null)` (trabajador) → `upsert({obra_id,trabajador_id,fecha,[campo]:hora,ubicacion_ok,distancia_metros})`.
29. `reintentarFichajePendiente(item)` → `upsert({obra_id,trabajador_id,fecha,[campo]:hora, ...(ubicacion_ok si definido), ...(distancia_metros si definido)})`.
30. `corregirHoras(obraId, trabajadorId, fecha, entrada|null, salida|null)` → `upsert({obra_id,trabajador_id,fecha,hora_entrada,hora_salida,hora_corregida:true})`.
31. `quitarDia(obraId, trabajadorId, fecha)` = `corregirHoras(…, null, null)`.
32. `moverFichajeDeObra(fichajeId, nuevaObraId)` → `from('fichajes').update({obra_id:nuevaObraId}).eq('id',fichajeId).select().single()`.
33. `guardarZonaFichaje(obraId, trabajadorId, fecha, ubicacion)` → `upsert({obra_id,trabajador_id,fecha,ubicacion})`.
34. `guardarTransporte(obraId, trabajadorId, fecha, transporte('propio'|'traido'), traidoPor|null)` → `upsert({obra_id,trabajador_id,fecha,transporte,traido_por})`.
35. `confirmarHorasCorregidas(obraId, trabajadorId, fecha)` → `upsert({obra_id,trabajador_id,fecha,confirmado_trabajador:true})`.

### Trabajadores
36. `listarTrabajadoresActivos()` → `from('trabajadores').select('*').eq('activo',true).order('nombre')`.
37. `crearTrabajador(nombre)` → `from('trabajadores').insert({owner_id:user.id, nombre}).select().single()`.

### Datos de Home gestor
38. `usosVehiculoDelDia(obraId, fecha)` → `from('usos_vehiculo').select('vehiculo_id').eq('obra_id',…).eq('fecha',fecha)`.
39. `gastosDeObraResumen(obraId)` → `from('gastos').select('importe,pagado_por,fecha').eq('obra_id',obraId)`.
40. `cobrosDeObraImportes(obraId)` → `from('cobros').select('importe').eq('obra_id',obraId)` (solo dueño/manager).
41. `tareasDeObra(obraId)` → `from('tareas').select('*').eq('obra_id',obraId).order('orden').order('fecha_inicio')`.

### Cliente / no-BD (para la capa de datos local)
42. `leerColaFichajes()` / `escribirColaFichajes(lista)` → `localStorage['obra_fichajes_pendientes']`.
43. `leerObraGuardada()` / `guardarObraActual(id)` → `localStorage['control-de-obra:obra-id']`.
44. `obtenerPosicion()` → `navigator.geolocation.getCurrentPosition` (high accuracy, 8000 ms, maximumAge 0).
45. `registrarServiceWorker()` → `navigator.serviceWorker.register('/sw.js')`.
46. Server (proxy): `updateSession(request)` → `createServerClient(...).auth.getUser()` + redirects (ver §1).
47. `reportarError(error, origen)` → (en `lib/errores.ts`, fuera de ámbito; RPC `registrar_error`) — invocado por `error.tsx` y `global-error.tsx`.
