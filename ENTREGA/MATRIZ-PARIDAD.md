# MATRIZ DE PARIDAD — Control de Obra v2 (Agente A)

Una fila por cada ID de `ESPECIFICACION-ESTRUCTURA.md`, más las preguntas abiertas (§19), los
defectos de v1 a corregir (§20) y las trampas de `TRAMPAS-Y-LIMITES-TECNICOS.md`.
Estados: ✔ hecho · ⚠ parcial · ✖ falta · ❓ pregunta abierta (se mantiene v1).
**Una fila ✔ sin evidencia cuenta como falta.**

Esqueleto generado el 2026-11-14 a partir de la especificación; la evidencia se rellena en la Fase 4.

## 1. Especificación (121 IDs)

| ID | Qué | Estado | Evidencia (archivo + cómo se verificó) | Nota |
|---|---|---|---|---|
| ACC-01 | Anonymous / shows a public landing that fits one viewport with no scrolling | ✖ | — | |
| ACC-02 | /login has three modes: *login*, *signup*, *recover*. The e-mail (never the | ✖ | — | |
| ACC-03 | Signup requires: e-mail, first name, last name, password (≥ 6) and a code. | ✖ | — | |
| ACC-04 | ?empresa=<code> or ?alta=<code> opens signup with the code pre-filled. | ✖ | — | |
| ACC-05 | Recover: sends a reset link to /reset-password; the confirmation message does not | ✖ | — | |
| ACC-06 | /reset-password: new password + repeat, ≥ 6, must match, expired-link message, | ✖ | — | |
| ACC-07 | Proxy (proxy.ts → lib/supabase/middleware.ts): refreshes the Supabase session on | ✖ | — | |
| ACC-08 | Dashboard gate chain (in this order): no session → landing (ACC-01) → platform admin | ✖ | — | |
| ACC-09 | Pending screen: shows the account e-mail; the user writes their full name | ✖ | — | |
| ACC-10 | Inactive subscription screen ("Suscripción inactiva"): explains that access is paused, | ✖ | — | |
| ACC-11 | Control notice ("Antes de fichar"), workers only: shown until the worker accepts | ✖ | — | |
| ACC-12 | Worker without a linked worker card sees "Falta un paso" on the clocking screen. | ✖ | — | |
| ACC-13 | Language selector on /login, /alta and Settings (all roles). | ✖ | — | |
| ACC-14 | Logout: | ✖ | — | |
| ONB-01 | /alta: reads the price with GET /api/alta/checkout ({disponible, importe, | ✖ | — | |
| ONB-02 | /alta/ok: calls GET /api/alta/codigo?session_id=… and shows the one-time alta | ✖ | — | |
| ONB-03 | Webhook POST /api/stripe/webhook: verifies the Stripe signature | ✖ | — | |
| ONB-04 | Without STRIPE_* / SUPABASE_SERVICE_ROLE_KEY the rest of the app works; /alta | ✖ | — | |
| SHL-01 | Layout: ≥ 768 px → fixed sidebar (logo, nav, logout) + content (max ≈ 768 px, | ✖ | — | |
| SHL-02 | Navigation by actor (labels are tr() keys): | ✖ | — | |
| SHL-03 | Top bar (when there is ≥ 1 obra): logo → Home (mobile), the current obra button | ✖ | — | |
| SHL-04 | Obra picker lists active obras only; choosing one makes it current. "Nueva obra" | ✖ | — | |
| SHL-05 | The current obra is persisted in localStorage (control-de-obra:obra-id). On a cold | ✖ | — | |
| SHL-06 | No obras: gestores see "Crea tu primera obra" (name, address); anyone else sees | ✖ | — | |
| SHL-07 | Pull-to-refresh at scroll-top fires a window event | ✖ | — | |
| SHL-08 | While obras load show a spinner. | ✖ | — | |
| SHL-09 | Closed obras are hidden from the picker | ✖ | — | |
| HOM-01 | Obra name and address. | ✖ | — | |
| HOM-02 | Big progress number = weighted average of task progress, weighted by task duration | ✖ | — | |
| HOM-03 | Hours chart: last 14 days of worked hours (sum over all workers on this obra); | ✖ | — | |
| HOM-04 | Planning card: "N capítulos · hasta {date}" + "· N con retraso" + a miniature Gantt | ✖ | — | |
| HOM-05 | Money card "Dinero de la obra": owner/manager see Cobrado / Gastado / Balance | ✖ | — | |
| HOM-06 | Tiles: "Fichados hoy" (people with an entry today on this obra) and "Coches hoy" | ✖ | — | |
| HOM-07 | Quick links: Fichajes, Vehículos¹, Gastos, Dinero (owner/manager only). | ✖ | — | |
| HOM-W1 | Obra name/address. | ✖ | — | |
| HOM-W2 | Obra progress % (RPC avance_obra(o_id); never budgets, | ✖ | — | |
| HOM-W3 | "Mis horas · {month}" total and overtime for the month. | ✖ | — | |
| HOM-W4 | Tiles: today's Entrada, today's Salida, "Días" of the month. | ✖ | — | |
| HOM-W5 | Call-to-action to /fichajes whose label depends on today: "Marcar mi entrada" / | ✖ | — | |
| FIC-01 | One row per (obra, worker, date). A worker may stamp in several obras on the same day. | ✖ | — | |
| FIC-02 | Hours are HH:MM text. For everyone except the owner, the server (not the phone) | ✖ | — | |
| FIC-03 | Workday length is a company setting (default 8 h). Worked minutes = exit − entry | ✖ | — | |
| FIC-04 | Some obras have a start-of-shift time and "minutes allowed before": a worker cannot | ✖ | — | |
| FIC-05 | A worker cannot delete a stamp (no DELETE policy). | ✖ | — | |
| FIC-06 | Never create "ghost" rows | ✖ | — | |
| FIC-07 | Geofence: if the module is ON and the obra has latitude/longitude, at the moment of | ✖ | — | |
| FIC-08 | Offline queue: if the request fails for network reasons (not a business rule), | ✖ | — | |
| FIC-09 | Corrected hours: when the owner changes hours the row is flagged hora_corregida | ✖ | — | |
| FIC-10 | Day navigation: previous/next day, cannot go beyond today, "Volver a hoy". | ✖ | — | |
| FIC-11 | "Fichando en {obra}" with "Cambiar" (obra picker sheet). | ✖ | — | |
| FIC-12 | Hint on days other than today: owner → "Otro día: toca «Corregir horas» en quien haga | ✖ | — | |
| FIC-13 | Banners: server/business error (plain message), and "Sin conexión: N fichaje(s) en cola…". | ✖ | — | |
| FIC-14 | One card per active worker (alphabetical, all workers of the company, not only | ✖ | — | |
| FIC-15 | "Añadir trabajador" inline (name). *(DB allows only owner/manager; v2 shows it only to th… | ✖ | — | |
| FIC-16 | Empty state "Todavía no hay trabajadores". | ✖ | — | |
| FIC-20 | Header: worker name and long date. Shows the current stamp ("Fichado ahora: a → b"). | ✖ | — | |
| FIC-21 | *Wrong obra?* block, only if the row exists and other active obras exist: choose the right | ✖ | — | |
| FIC-22 | Two time inputs, each with its own clear (×) control (iOS time pickers cannot be | ✖ | — | |
| FIC-23 | "Historial de cambios": newest first; time changes as a → b pasó a c → d, obra moves as | ✖ | — | |
| FIC-24 | "Quitar este día (no vino)": two-step confirmation; clears both times; the row stays | ✖ | — | |
| FIC-30 | Hero: "Mis horas · {month}" = total and overtime of the month across all obras. | ✖ | — | |
| FIC-31 | Day navigation (same as FIC-10). | ✖ | — | |
| FIC-32 | "Estoy en {obra}" with "Cambiar": a worker may | ✖ | — | |
| FIC-33 | Banners: error; offline ("tu fichaje está guardado en el móvil y se enviará solo…"). | ✖ | — | |
| FIC-34 | Day card: day total + overtime pill; "Horas corregidas por el dueño"; if corrected and | ✖ | — | |
| FIC-35 | Today: Entrada / Salida stamps with the geofence (FIC-07) and offline queue (FIC-08). | ✖ | — | |
| FIC-36 | "Añadir zona / tarea" (today only), sheet "¿Dónde has trabajado hoy?". | ✖ | — | |
| FIC-37 | Transport card (today, module ON): "¿Cómo has llegado?" → "En mi coche" / "Me trajeron" + | ✖ | — | |
| FIC-38 | Non-today hint: "Solo puedes fichar el día de hoy. Si falta algo de otro día, díselo al j… | ✖ | — | |
| GAS-01 | Everything is an *expense* (gastos): ticket or invoice, with optional photo/PDF, | ✖ | — | |
| GAS-02 | Summary card: title changes with the filter ("Total gastado" / "Pagado por ti" / "Pagado | ✖ | — | |
| GAS-03 | Filters: Todo / Pagué yo / La empresa + month filter ("Filtrar por mes" → arrows, | ✖ | — | |
| GAS-04 | List row: title = provider, else note, else category; second line = note (if not the | ✖ | — | |
| GAS-05 | "Añadir gasto o factura" form: obra select (only if > 1 obra), photo/PDF (optional; | ✖ | — | |
| GAS-06 | Provider selector: favourites first ("★ Favoritos"), then "Otros", then "+ Otro | ✖ | — | |
| GAS-07 | Detail sheet: title/amount/category/date, "Pagué yo" badge, file viewer (signed URL, image | ✖ | — | |
| GAS-08 | Storage: bucket facturas, path {obra_id}/gastos/{uuid}.{jpg/pdf}. | ✖ | — | |
| DIN-01 | Site leads see "Solo para el dueño y el manager" and nothing else. | ✖ | — | |
| DIN-02 | *Obra card*: "Cobrado del cliente"; "Recibido del jefe (esta obra)" (owner, module ON, on… | ✖ | — | |
| DIN-03 | *Owner's cash box* (owner only, module caja_jefe): "Me ha dado el jefe" (all | ✖ | — | |
| DIN-04 | Tabs "Del cliente" / "Del jefe" (the latter only with the cash box). *Client payments*: | ✖ | — | |
| DIN-05 | All sums are done in cents (lib/dinero.ts) — never with floating euros. | ✖ | — | |
| PLA-01 | Hero "Avance de la obra" (same weighted % as HOM-02) + "{hechas} de {total} tareas termin… | ✖ | — | |
| PLA-02 | Card: "Del {desde} al {hasta}", total days, "Presupuestado" (sum of task budgets), the Ga… | ✖ | — | |
| PLA-03 | Gantt: month scale, a "Hoy" marker, one bar per task laid out in percentages of the | ✖ | — | |
| PLA-04 | Task form: name, start, end (end ≥ start, with the live duration), progress 0–100 (slider… | ✖ | — | |
| PLA-05 | Excel import ("Traer el plan del Excel"): file picker (.xlsx); the plan is read from the | ✖ | — | |
| PLA-06 | Errors from the DB are shown, never swallowed. | ✖ | — | |
| VEH-01 | *No kilometres anymore* (they cannot be read reliably). A usage record is vehicle + day + | ✖ | — | |
| VEH-02 | Day navigation; counter "N coche(s) en uso este día"; list of vehicles with, per vehicle, | ✖ | — | |
| VEH-03 | Tap a vehicle → sheet for that day: list of its obras (edit / remove with confirmation), | ✖ | — | |
| VEH-04 | "Añadir vehículo" (name, e.g. "Furgoneta — 1234 ABC") for owner/manager. Workers see the | ✖ | — | |
| NOT-01 | Day navigation. One note per (obra, day). No note → "Sin nota de voz el {fecha}…" and a r… | ✖ | — | |
| NOT-02 | "Últimas notas": the 12 latest; tapping jumps to that day. | ✖ | — | |
| NOT-03 | Recorder negotiates the format the device supports (webm, mp4/m4a, aac, ogg; Safari | ✖ | — | |
| NOT-04 | Storage: bucket notas, path {obra_id}/{uuid}.{ext}. | ✖ | — | |
| RES-01 | Month navigation (previous/next, "Mes actual", next disabled on the current month) and | ✖ | — | |
| RES-02 | "Exportar este mes a Excel": downloads <obra> - <month>.xlsx with sheets | ✖ | — | |
| RES-03 | Workers: one row per worker (days, overtime pill, "N sin salida", total hours); tap → she… | ✖ | — | |
| RES-04 | Vehicles: days used per vehicle in this obra; tap → sheet with the month | ✖ | — | |
| RES-05 | Expenses: month total + "Pagado por ti", then | ✖ | — | |
| AJU-01 | Language selector (all). Owner only, in this order: Accesos, Soporte, Jornada, | ✖ | — | |
| AJU-02 | *Accesos*: the invitation link <origin>/login?empresa=<company code> with a copy | ✖ | — | |
| AJU-03 | *Soporte*: e-mail of an already-registered account + hours (1–720, default 24) → | ✖ | — | |
| AJU-04 | *Jornada*: hours of a normal workday (1–24, step 0.5). | ✖ | — | |
| AJU-05 | *Jefe de obra*: switch "can see | ✖ | — | |
| AJU-06 | *Módulos*: five switches with descriptions (§1.3). | ✖ | — | |
| AJU-07 | *Obras*: every obra (tap = make it current and go Home, active or closed); active/closed | ✖ | — | |
| AJU-08 | *Delete obra* (irreversible, owner only): shows what is lost; requires typing the exact o… | ✖ | — | |
| AJU-09 | *Trabajadores* / *Vehículos*: lists with Activo/Baja toggles and inline add. Never hard-d… | ✖ | — | |
| AJU-W1 | "Mi cuenta" card (name, e-mail, role label, hint "díselo al jefe"), language, logout. | ✖ | — | |
| ADM-01 | "Todas las empresas": count; per company name, creation date, members, obras, company cod… | ✖ | — | |
| ADM-02 | "Códigos para empresas nuevas": create (optional note; the new code is copied | ✖ | — | |
| ADM-03 | "Errores de la app": last 100 errors (time, browser vs server, company/e-mail, message, r… | ✖ | — | |
| ADM-04 | "Actualizar" button. | ✖ | — | |
| PLT-01 | *Three languages*: es (source), uk, en. Auto-detected from the phone (uk/ru → uk; | ✖ | — | |
| PLT-02 | *PWA*: manifest (standalone, icons 192/512 + Apple touch icon, theme colour), | ✖ | — | |
| PLT-03 | *Error logging, no third parties*: browser errors (instrumentation-client.ts, | ✖ | — | |
| PLT-04 | *EU hosting*: vercel.json pins functions to dub1 (Dublin), next to the EU Supabase | ✖ | — | |
| PLT-05 | *Data safety*: obras/workers/vehicles/providers/cash/settings cannot be deleted by cascade | ✖ | — | |
| PLT-06 | *Isolation between companies*: every company-level row carries empresa_id; the RLS and | ✖ | — | |

## 2. Preguntas abiertas (§19) — no se cambia el comportamiento

| ID | Qué | Estado | Evidencia (archivo + cómo se verificó) | Nota |
|---|---|---|---|---|
| Q-01 | Two balance formulas. | ❓ | — | se mantiene v1; ver PREGUNTAS.md |
| Q-02 | Offline stamps get the delivery time (server clock overwrites the tap time) | ❓ | — | se mantiene v1; ver PREGUNTAS.md |
| Q-03 | Workers can read the worker-name list | ❓ | — | se mantiene v1; ver PREGUNTAS.md |
| Q-04 | Product name | ❓ | — | se mantiene v1; ver PREGUNTAS.md |
| Q-05 | Logo. | ❓ | — | se mantiene v1; ver PREGUNTAS.md |
| Q-06 | "Días" tile on worker Home | ❓ | — | se mantiene v1; ver PREGUNTAS.md |

## 3. Defectos de v1 a corregir (§20)

| ID | Qué | Estado | Evidencia (archivo + cómo se verificó) | Nota |
|---|---|---|---|---|
| FIX-1 | Selector de obra: «Nueva obra» solo para dueño/manager (SHL-04) | ✖ | — | |
| FIX-2 | «Añadir trabajador» en la cuadrilla solo para dueño/manager (FIC-15) | ✖ | — | |
| FIX-3 | Huecos de i18n: Cobrado/Gastado/Balance, estados, fechas es-ES fijas, precio de /alta, cabeceras Excel | ✖ | — | |
| FIX-4 | README correcto | ✖ | — | |
| FIX-5 | Línea base: lint con 0 errores (incl. react-hooks/purity en SoporteAcceso), tests vía runner, 84743→85706 | ✖ | — | |

## 4. Trampas y límites técnicos (45)

| ID | Qué | Estado | Evidencia (archivo + cómo se verificó) | Nota |
|---|---|---|---|---|
| T-01 | Never build a calendar date with toISOString(). | ✖ | — | |
| T-02 | Month filters use half-open ranges. | ✖ | — | |
| T-03 | Server time is the only valid clock for a stamp | ✖ | — | |
| T-04 | Viewport. | ✖ | — | |
| T-05 | No sideways movement, ever. | ✖ | — | |
| T-06 | Consequence: nothing in the app may require horizontal scrolling. | ✖ | — | |
| T-07 | Flex children need min-w-0. | ✖ | — | |
| T-08 | Soft keyboard. | ✖ | — | |
| T-09 | iOS time inputs cannot be empty. | ✖ | — | |
| T-10 | Camera/file inputs. | ✖ | — | |
| T-11 | Audio. | ✖ | — | |
| T-12 | Standalone PWA has no browser chrome. | ✖ | — | |
| T-13 | Safe-area for fixed bars. | ✖ | — | |
| T-14 | Touch targets ≥ 44×44 CSS px | ✖ | — | |
| T-15 | Test with build + start, never next dev, on a phone. | ✖ | — | |
| T-16 | The service worker must NEVER cache page navigations. | ✖ | — | |
| T-17 | Public path / is compared by exact equality | ✖ | — | |
| T-18 | Root layout needs export const dynamic = "force-dynamic" | ✖ | — | |
| T-19 | Vercel region is pinned to dub1 | ✖ | — | |
| T-20 | Vercel Hobby is non-commercial. | ✖ | — | |
| T-21 | AGENTS.md says it and it is true: read the relevant guide in | ✖ | — | |
| T-22 | Lint rule react-hooks/set-state-in-effect is disabled on purpose | ✖ | — | |
| T-23 | tsconfig.json excludes scripts/. | ✖ | — | |
| T-24 | Permissions live in the database, not in the UI. | ✖ | — | |
| T-25 | Always filter miembros by user_id. | ✖ | — | |
| T-26 | NULL role pitfall. | ✖ | — | |
| T-27 | Reading the subscription state must not go through mi_empresa_id() | ✖ | — | |
| T-28 | History trigger must be AFTER, not BEFORE. | ✖ | — | |
| T-29 | No cascades. | ✖ | — | |
| T-30 | Never create "ghost" fichajes | ✖ | — | |
| T-31 | Money is summed in cents. | ✖ | — | |
| T-32 | Never ship secrets. | ✖ | — | |
| T-33 | Don't paste SQL into Supabase's Monaco editor by typing. | ✖ | — | |
| T-34 | Painted-cell Gantts. | ✖ | — | |
| T-35 | In Node/ESM use XLSX.read(readFileSync(path)) — XLSX.readFile does not exist when the | ✖ | — | |
| T-36 | SheetJS weighs ~1 MB: load it lazily where the user imports a plan (v1 does | ✖ | — | |
| T-37 | The year is not in the file; it is guessed so that week 1 starts on a Monday and can be | ✖ | — | |
| T-38 | The Spanish source text is the key (tr("Corregir horas")). Changing a Spanish string | ✖ | — | |
| T-39 | Text length differs label by label, not on average. Measured on the v1 dictionaries | ✖ | — | |
| T-40 | Plurals: use trN(n, "{n} día", "{n} días"); Ukrainian needs three forms joined with / | ✖ | — | |
| T-41 | Language is a module-level variable and IdiomaProvider remounts the whole tree when it | ✖ | — | |
| T-42 | Windows 11, PowerShell *and* Git-Bash exist; they use different syntax. Paths with (…) su… | ✖ | — | |
| T-43 | Node 24.x, npm 11.x. sharp is a dev dependency (icon generation, scripts/generar-iconos.m… | ✖ | — | |
| T-44 | The Supabase and Vercel sessions of the owner expire after days; the owner re-logs in her… | ✖ | — | |
| T-45 | Node-native tests cannot resolve the @/ alias or extensionless imports. | ✖ | — | |
