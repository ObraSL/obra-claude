# Control de Obra — FROZEN STRUCTURE SPECIFICATION (v1 → v2)

Reference version: git commit `4ed79ad` (2026-09-30), repository `D:\obra`.
This document describes **what the product is and does**, never how it looks.
Everything here is **frozen**: v2 must reproduce it exactly. Only the visual
design and the internal code organisation are yours to change.

## 0. How to use this document

* **Source of truth, in this order:** (1) `supabase/schema.sql` (the database is the
  authority on permissions), (2) the v1 code behaviour, (3) this document, (4) older docs
  (`TRASPASO.md` and `RESUMEN-APP.md` are **outdated** — written before multi-company,
  billing, geolocation, i18n and the history log; do not trust them).
* **If this document and the code disagree, the code wins.** Do not silently pick one:
  write the discrepancy in `ENTREGA/00-inventario.md` and keep v1's behaviour.
* Every line below has an ID (`ACC-03`, `FIC-12`…). Your **parity matrix** has one row per ID.
* UI texts are quoted in Spanish exactly as in the code: they are the i18n keys. Do not
  reword them (see `MASTER-PROMPT.md` §8).
* "Gestores" = owner + manager + site lead (`jefe_obra`). "Crew view" = the screen where a
  gestor stamps everybody; "worker view" = the screen where a worker stamps themself.
* Words such as *sheet, card, tab, chip, button, badge* name the **role** of an element, not a
  required component. A "sheet" may be a bottom sheet, a modal or a full page; a "tab" a tab, a
  segmented control or a list — **as long as the steps, the data, the permissions and the
  confirmations are the same** and the keyboard rule (T-08) holds.

---

## 1. Actors and what each one can do

### 1.1 Actors

| Actor | How they exist | Where they land |
|---|---|---|
| Anonymous visitor | no session | public landing `/` |
| Pending account | registered, `miembros.aprobado = false` | "waiting for approval" screen |
| `trabajador` (worker) | approved, usually linked to a worker card (`trabajador_id`) | worker home |
| `jefe_obra` (site lead) | approved, assigned one obra (`obra_id`), or all obras if the company flag `jefe_ve_todas` is on | manager home |
| `manager` | approved | manager home |
| `dueno` (owner) | created the company with an *alta code*, or was promoted | manager home |
| Support account | a registered account the owner temporarily grants owner-level access (hours-limited, logged) | same as owner while the grant lasts |
| Platform admin | row in `admins_plataforma`; belongs to **no** company | `/admin` only, never the dashboard |

### 1.2 Capability matrix (what the UI offers; the DB is the authority)

Where the DB is **broader** than the UI, v1's UI wins and you reproduce the UI. Known case: the
DB would also let a **manager** update an obra's location/schedule, but only the **owner** is
offered the screen — keep it owner-only.

| Capability | Owner | Manager | Site lead | Worker |
|---|---|---|---|---|
| Manager home (progress, hours chart, plan, money) | ✔ | ✔ | ✔ (own obra, or all if flag) | ✖ (has worker home) |
| Stamp their own hours | — | — | — | ✔ (today only) |
| Stamp the crew (crew view) | ✔ | ✔ | ✔ (own obra) | ✖ |
| Correct hours / move a stamp to another obra / remove a day | ✔ | ✖ | ✖ | ✖ |
| Read the correction history | ✔ | ✔ | ✔ (own obra) | ✔ (own rows only) |
| Confirm corrected hours ("Confirmo") | ✖ | ✖ | ✖ | ✔ (own) |
| Expenses: create/edit/delete (paid by the company) | ✔ | ✔ | ✔ (own obra) | ✖ |
| Expenses paid by the owner ("Pagué yo"): create/edit/delete | ✔ **only** | ✖ | ✖ | ✖ |
| Provider list | ✔ | ✔ | ✔ | ✖ |
| Money screen: client payments (`cobros`) | ✔ | ✔ | ✖ (screen blocked) | ✖ |
| Owner's cash box (`entregas`: money the boss gives the owner) | ✔ **only** | ✖ | ✖ | ✖ |
| Planning: view/edit/import | ✔ | ✔ | ✔ (own obra) | ✖ (sees only the % via RPC) |
| Vehicles: log usage per day/obra | ✔ | ✔ | ✔ | ✖ (read-only list) |
| Vehicles master list (add/deactivate) | ✔ | ✔ | ✖ | ✖ |
| Voice notes | ✔ | ✔ | ✔ | ✖ |
| Summary + Excel export | ✔ | ✔ | ✔ | ✖ |
| Create / close obras | ✔ | ✔ | ✖ | ✖ |
| Obra location & schedule, **delete obra** | ✔ **only** | ✖ | ✖ | ✖ |
| Workers master list (add/deactivate) | ✔ | ✔ | ✖ | ✖ |
| Approve accounts, set roles, link worker cards, invite link | ✔ **only** | ✖ | ✖ | ✖ |
| Settings: workday length, "site lead sees all", modules | ✔ **only** | ✖ | ✖ | ✖ |
| Grant temporary support access | ✔ **only** | ✖ | ✖ | ✖ |
| Read the worker *names* list of the company | ✔ | ✔ | ✔ | ✔ (needed to show who drives a vehicle; **never** other workers' hours) |

Notes that are easy to get wrong:
* A worker can read **all active obras** of the company (to choose where they are today);
  a site lead only their own unless the flag is on.
* The Spanish word for owner-only enforcement is "solo el dueño": it is enforced by DB
  triggers, not only by hiding buttons.
* A pending account sees **nothing** of the company.

### 1.3 Company modules (owner toggles in Settings → "Módulos"; default all ON)

| Module key | Hides when OFF |
|---|---|
| `vehiculos` | Vehicles route, nav item, Home tiles "Coches hoy" and the Vehicles quick link |
| `notas_voz` | Voice notes route and nav item |
| `caja_jefe` | Owner's cash box card, "Del jefe" tab, "Recibido del jefe (esta obra)" line |
| `transporte` | "¿Cómo has llegado?" card (worker) and the transport line (crew view) |
| `geolocalizacion` | Geofence check when stamping and the location-permission prompt in the notice screen |

A module that is OFF disappears from menus, Home and every screen **and cannot be opened by
typing the URL** (redirect to `/`). Nothing is deleted.

---

## 2. Route map

| Route | Who | What |
|---|---|---|
| `/` | everyone | anonymous: landing; signed-in: Home (manager or worker variant) |
| `/login` | anonymous | login / signup / recover (+ `?empresa=` and `?alta=` codes) |
| `/reset-password` | via e-mail link | set a new password |
| `/alta`, `/alta/ok` | anonymous | pay by card → receive a company *alta code* |
| `/api/alta/checkout` (GET, POST), `/api/alta/codigo` (GET), `/api/stripe/webhook` (POST) | public/server | billing endpoints |
| `/fichajes` | all approved | crew view (gestores) or worker view (workers) |
| `/vehiculos` | all approved (module) | vehicle usage |
| `/gastos` | gestores | expenses (tickets and invoices together) |
| `/facturas` | — | **redirect** to `/gastos` (legacy bookmarks) |
| `/dinero` | owner, manager | client payments, boss money, balances |
| `/notas` | gestores (module) | voice notes |
| `/planificacion` | gestores | Gantt plan, Excel import |
| `/resumen` | gestores | monthly summary + Excel export |
| `/ajustes` | all approved | settings (gestor variant / worker variant) |
| `/admin` | platform admin only | companies, alta codes, error log |
| `/plantilla-plan-obra.xlsx` | public | downloadable plan template |
| `/manifest.webmanifest`, `/sw.js`, `/icons/*` | public | PWA |

Routes a worker cannot open even by typing the URL: `/gastos /facturas /notas /resumen
/planificacion /dinero` (→ redirect to `/`). Routes of a module that is OFF: same.

---

## 3. Access, sessions and the gate chain

**ACC-01** Anonymous `/` shows a public landing that fits **one viewport with no scrolling**
(100dvh; must hold from 320×568 to 430×932). It offers a clear way to sign in. Its *content*
is free (v1 shows a fake obra picker, a fake "72 %" card and a plan illustration, all
clearly labelled as preview). It must never show real data.

**ACC-02** `/login` has three modes: *login*, *signup*, *recover*. The e-mail (never the
password) is remembered in `localStorage` key `control-de-obra:email`. After a wrong password
the user **stays on the screen**, the e-mail stays, only the password field is cleared and
focused, and a prominent "Contraseña incorrecta. Vuelve a escribirla." message appears.
"Email not confirmed" has its own message. Success → `/`.

**ACC-03** Signup requires: e-mail, first name, last name, password (≥ 6) and a **code**.
The code is checked live (400 ms debounce) with RPC `comprobar_codigo_registro(p_codigo)`:
* *company code* → "Te unes a la empresa «X». Su responsable tendrá que aprobarte." (joins
  as a pending worker);
* *alta code* → "Código válido: vas a crear tu propia empresa (14 días de prueba)." and a
  required "Nombre de tu empresa" field appears;
* anything else → "Ese código no vale (o ya se usó). Pídelo de nuevo." and submit is disabled.
Metadata sent with `supabase.auth.signUp`: `empresa_codigo` **or** `codigo_alta` +
`nombre_empresa`, plus `nombre`, `apellidos`; `emailRedirectTo = <origin>/login`. The account
must confirm its e-mail. Link "¿Tu empresa aún no tiene código? Consíguelo aquí" → `/alta`.
There is **no signup without a code**.

**ACC-04** `?empresa=<code>` or `?alta=<code>` opens signup with the code pre-filled.

**ACC-05** Recover: sends a reset link to `/reset-password`; the confirmation message does not
reveal whether the e-mail exists.

**ACC-06** `/reset-password`: new password + repeat, ≥ 6, must match, expired-link message,
success message then redirect to `/` after 1.5 s. This route must **not** bounce a signed-in
user away (the recovery link itself creates a session).

**ACC-07** Proxy (`proxy.ts` → `lib/supabase/middleware.ts`): refreshes the Supabase session on
every request; unauthenticated users go to `/login` except on public paths (`/login`,
`/reset-password`, `/alta`, `/api/alta`, `/api/stripe`, `/plantilla-plan-obra.xlsx`, and `/`
by **exact** match). `/login` redirects to `/` when a session exists.

**ACC-08** Dashboard gate chain (in this order): no session → landing (ACC-01) → platform admin
→ redirect to `/admin` → forbidden route (worker on gestor route, or module OFF) → redirect to
`/` → account not approved → ACC-09 → company subscription inactive → ACC-10 → worker whose
accepted notice version ≠ current → ACC-11 → the app.

**ACC-09** Pending screen: shows the account e-mail; the user writes their full name
(RPC `guardar_mi_nombre`); after saving, a "Esperando a que te den acceso" block with
"Comprobar de nuevo" (re-reads the member row); logout.

**ACC-10** Inactive subscription screen ("Suscripción inactiva"): explains that access is paused,
nothing was deleted, contact the platform administrator; logout. Triggered when the company is
`bloqueada` or `activa_hasta` is in the past. (The DB also stops returning the company's data.)

**ACC-11** Control notice ("Antes de fichar"), **workers only**: shown until the worker accepts
the current version (`AVISO_CONTROL_VERSION = "2026-09-28"`, stored as
`aviso_control_version` + `aviso_control_leido_en`). Content: hours are recorded with the
server clock; if the geolocation module is on, the app checks inside/outside the obra at the
moment of stamping and stores no exact location; some obras have a minimum time to stamp in.
Button "Lo he leído": asks the browser's location permission **once** (only if the module is
on), then calls RPC `confirmar_aviso_control(version)`. Logout is available. Never call this
"consent" in text (the owner's legal advice: it is a documented notice).

**ACC-12** Worker without a linked worker card sees "Falta un paso" on the clocking screen.

**ACC-13** Language selector on `/login`, `/alta` and Settings (all roles). **ACC-14** Logout:
sidebar (desktop), Settings (mobile) and on every gate screen and `/admin`.

---

## 4. Company onboarding and billing

**ONB-01** `/alta`: reads the price with `GET /api/alta/checkout` (`{disponible, importe,
moneda, intervalo}`); if billing is not configured shows "El alta con tarjeta todavía no está
abierta…". E-mail field → `POST /api/alta/checkout` → redirect to Stripe Checkout:
subscription, **14-day trial**, billing address required, tax-id collection on, locale `es`,
success `/alta/ok?session_id=…`, cancel `/alta`.

**ONB-02** `/alta/ok`: calls `GET /api/alta/codigo?session_id=…` and shows the one-time alta
code with a copy button and "Crear mi empresa" → `/login?alta=<code>`. Error state "Pago sin
confirmar" with "Si el cargo aparece en tu tarjeta, escríbenos y te damos el código.".

**ONB-03** Webhook `POST /api/stripe/webhook`: verifies the Stripe signature
(`STRIPE_WEBHOOK_SECRET`); `checkout.session.completed` → `registrar_pago_alta(...)`;
`customer.subscription.created|updated|deleted` → `actualizar_pago_suscripcion(...)` with
`activa_hasta = max(period end, trial end) + 3 days` (or *now* if canceled/unpaid). Uses the
service-role key server-side only.

**ONB-04** Without `STRIPE_*` / `SUPABASE_SERVICE_ROLE_KEY` the rest of the app works; `/alta`
simply says billing is unavailable.

---

## 5. Application shell and navigation

**SHL-01** Layout: ≥ 768 px → fixed sidebar (logo, nav, logout) + content (max ≈ 768 px,
centred); mobile → top bar + bottom navigation. A pull-to-refresh gesture exists on mobile.

**SHL-02** Navigation by actor (labels are tr() keys):

| Actor | Mobile bottom bar | Desktop sidebar |
|---|---|---|
| Owner / manager | Fichajes, Vehículos¹, Gastos, Dinero, Notas de voz¹, Ajustes | Inicio, Planificación, Fichajes, Vehículos¹, Gastos, Dinero, Notas de voz¹, Resumen, Ajustes |
| Site lead | same **without Dinero** | same **without Dinero** |
| Worker | Inicio, Mis horas, Vehículos¹, Ajustes | same |

¹ only if the module is ON. **Planning** is intentionally not in the mobile bar (v1 ran out of
width on narrow iPhones with 7 icons); on mobile it is reached from Home. **Summary** on
mobile is reached from the top bar shortcut. Your navigation *form* is free, but every
function must stay reachable by the same actors with no more taps than in v1, and it must
fit at 320 px wide.

**SHL-03** Top bar (when there is ≥ 1 obra): logo → Home (mobile), the **current obra** button
(status dot active/closed + name) opening the obra picker, and for gestores a shortcut to
Summary. The logo returning to Home from any screen is an explicit owner request.

**SHL-04** Obra picker lists **active** obras only; choosing one makes it current. "Nueva obra"
(name required, address optional) — *v1 shows this to every role although the DB only lets
owner/manager create obras; v2 shows it only to owner/manager.*

**SHL-05** The current obra is persisted in `localStorage` (`control-de-obra:obra-id`). On a cold
start prefer the stored one if still active, else the first active, else the first. An obra
opened on purpose from Settings (even a closed one) stays current for the session.

**SHL-06** No obras: gestores see "Crea tu primera obra" (name, address); anyone else sees
"no obras assigned yet". **SHL-07** Pull-to-refresh at scroll-top fires a window event
(`obra:refrescar`); screens re-fetch with the same loader they use on entry.
**SHL-08** While obras load show a spinner. **SHL-09** Closed obras are hidden from the picker
and managed from Settings → Obras (tap an obra to open it entirely).

---

## 6. Home

### 6.1 Manager Home (owner, manager, site lead)

**HOM-01** Obra name and address.
**HOM-02** Big progress number = weighted average of task progress, **weighted by task duration
in days**, shown with two decimals (e.g. `60,11 %`); link to Planning; if there are no tasks
a hint "Todavía no hay plan — añádelo o tráelo del Excel".
**HOM-03** Hours chart: last **14 days** of worked hours (sum over all workers on this obra);
empty state "Sin horas fichadas estas dos semanas"; footer: planned end date ("Fin previsto")
or "Últimas 2 semanas", and "Horas del mes" (rounded hours).
**HOM-04** Planning card: "N capítulos · hasta {date}" + "· N con retraso" + a miniature Gantt
(one bar per task, colour by state) → Planning.
**HOM-05** Money card "Dinero de la obra": owner/manager see **Cobrado / Gastado / Balance**
(whole euros, balance with explicit sign and positive/negative colour); site lead sees
"Gastado en total". Then "Este mes: X · pagado por ti Y" (the second part only if > 0) and, if
the plan has budgets, "Presupuesto X" with "% gastado" and a bar (alert state above 100 %).
Links to `/dinero` (or `/gastos` for the site lead). **See open question Q-01.**
**HOM-06** Tiles: "Fichados hoy" (people with an entry today on this obra) and "Coches hoy"
(distinct vehicles used here today; hidden if the vehicles module is OFF).
**HOM-07** Quick links: Fichajes, Vehículos¹, Gastos, Dinero (owner/manager only).

### 6.2 Worker Home

**HOM-W1** Obra name/address. **HOM-W2** Obra progress % (RPC `avance_obra(o_id)`; never budgets,
never money). **HOM-W3** "Mis horas · {month}" total and overtime for the month.
**HOM-W4** Tiles: today's Entrada, today's Salida, "Días" of the month.
**HOM-W5** Call-to-action to `/fichajes` whose label depends on today: "Marcar mi entrada" /
"Marcar mi salida" / "Mis horas de hoy".

---

## 7. Hours (`/fichajes`) — the core of the product

### 7.1 Rules that apply everywhere

**FIC-01** One row per (obra, worker, date). A worker may stamp in several obras on the same day.
**FIC-02** Hours are `HH:MM` text. **For everyone except the owner, the server (not the phone)
chooses the time** (`Europe/Madrid`), only for **today**, and **only once** per field; trying
again returns "La entrada ya está fichada. Solo el dueño puede cambiarla." (same for exit).
The UI must show the value the server returns, never the value the phone sent.
**FIC-03** Workday length is a company setting (default 8 h). Worked minutes = exit − entry
(**lunch is not deducted**; day shifts only); overtime = worked − workday if positive. A row
with an entry but no exit is "sin cerrar" and excluded from totals. Exit ≤ entry is invalid.
Formatting: `8h 30m`, `8h`, `—`.
**FIC-04** Some obras have a start-of-shift time and "minutes allowed before": a worker cannot
stamp the entry earlier ("Todavía no puedes fichar: el turno empieza a las …"). Owner exempt.
**FIC-05** A worker cannot delete a stamp (no DELETE policy). **FIC-06** Never create "ghost" rows
with no hours (v1 blocks saving empty hours).
**FIC-07** Geofence: if the module is ON **and** the obra has latitude/longitude, at the moment of
stamping the app asks for the position (high accuracy, 8 s timeout), computes the Haversine
distance to the obra, and stores only `ubicacion_ok` (distance ≤ obra radius, default 150 m)
and `distancia_metros`. Exact coordinates are never stored. It informs, it never blocks; no
permission / no GPS → stamp anyway with `null`.
**FIC-08** Offline queue: if the request fails for **network** reasons (not a business rule),
the tap is stored in `localStorage` key `obra_fichajes_pendientes` and retried on the `online`
event and every 20 s; the button shows "Enviando…" and cannot be tapped again. A reply of
"ya está fichad…" means the first attempt did arrive: fetch the real row and drop the item.
Business-rule errors are shown, not retried. **See open question Q-02.**
**FIC-09** Corrected hours: when the owner changes hours the row is flagged `hora_corregida`
and the change is written to `fichajes_historial` (before/after, who, when; also obra moves),
by an AFTER trigger. The worker then sees the correction and must confirm
(`confirmado_trabajador`).

### 7.2 Crew view (gestores)

**FIC-10** Day navigation: previous/next day, cannot go beyond today, "Volver a hoy".
**FIC-11** "Fichando en {obra}" with "Cambiar" (obra picker sheet).
**FIC-12** Hint on days other than today: owner → "Otro día: toca «Corregir horas» en quien haga
falta."; others → "Las horas de otros días solo las puede cambiar el dueño."
**FIC-13** Banners: server/business error (plain message), and "Sin conexión: N fichaje(s) en cola…".
**FIC-14** One card per **active** worker (alphabetical, all workers of the company, not only
those of this obra): name; "También hoy en: [obra links]" (tapping switches the current obra);
zone/task button (sheet "Zona / tarea"); worked time + overtime pill; badges "Horas corregidas por
el dueño" and "Confirmado / Sin confirmar" (shown when corrected or unconfirmed); "Fichó fuera
de la obra (a N m)" when `ubicacion_ok = false`; transport line (module ON); **Entrada / Salida**
stamps (only today; Salida needs an Entrada or a pending one; a stamped one is disabled;
pending shows "Enviando…"); owner only: "Corregir horas".
**FIC-15** "Añadir trabajador" inline (name). *(DB allows only owner/manager; v2 shows it only to them.)*
**FIC-16** Empty state "Todavía no hay trabajadores".

### 7.3 Owner correction sheet ("Corregir horas")

**FIC-20** Header: worker name and long date. Shows the current stamp ("Fichado ahora: a → b").
**FIC-21** *Wrong obra?* block, only if the row exists and other active obras exist: choose the right
obra, then a button that names the destination ("Mover a {obra}"); success message; the stamp
leaves this obra's list; the move is written to history.
**FIC-22** Two time inputs, each with its own **clear (×)** control (iOS time pickers cannot be
empty), validation messages ("Pon también la hora de entrada.", "La salida tiene que ser
después de la entrada."), live total ("En total: …"), info line that it will be marked as
corrected. "Guardar horas" is disabled when invalid **or empty**.
**FIC-23** "Historial de cambios": newest first; time changes as `a → b pasó a c → d`, obra moves as
"Movido de X a Y", each with date-time.
**FIC-24** "Quitar este día (no vino)": two-step confirmation; clears both times; the row stays
flagged as corrected so the removal is visible.

### 7.4 Worker view

**FIC-30** Hero: "Mis horas · {month}" = total and overtime of the month across **all** obras.
**FIC-31** Day navigation (same as FIC-10). **FIC-32** "Estoy en {obra}" with "Cambiar": a worker may
pick any active obra of the company.
**FIC-33** Banners: error; offline ("tu fichaje está guardado en el móvil y se enviará solo…").
**FIC-34** Day card: day total + overtime pill; "Horas corregidas por el dueño"; if corrected and
unconfirmed: "Quedó así: a → b. ¿Está bien?" with **"Confirmo"** (sets `confirmado_trabajador`).
**FIC-35** Today: **Entrada / Salida** stamps with the geofence (FIC-07) and offline queue (FIC-08).
Other days: read-only "Entrada / Salida" values.
**FIC-36** "Añadir zona / tarea" (today only), sheet "¿Dónde has trabajado hoy?".
**FIC-37** Transport card (today, module ON): "¿Cómo has llegado?" → "En mi coche" / "Me trajeron" +
sheet "¿Quién te trajo?" (free text, deliberately not a list of colleagues).
**FIC-38** Non-today hint: "Solo puedes fichar el día de hoy. Si falta algo de otro día, díselo al jefe."

---

## 8. Expenses (`/gastos`) — tickets and invoices are one thing

**GAS-01** Everything is an *expense* (`gastos`): ticket **or** invoice, with optional photo/PDF,
amount, date, category, optional provider, optional note, and **who paid**: the company
(`empresa`) or the owner out of pocket / from the boss's money (`personal`, UI label
"Pagué yo"). The old `facturas` table is a frozen copy; v2 does not use it. Imported old
invoices carry `factura_origen_id` and **share the file** with that copy (never delete it).
**GAS-02** Summary card: title changes with the filter ("Total gastado" / "Pagado por ti" / "Pagado
por la empresa", plus the month when set), the amount, the count; with filter "Todo": "De eso,
pagado por ti".
**GAS-03** Filters: **Todo / Pagué yo / La empresa** + month filter ("Filtrar por mes" → arrows,
month name, "Ver todas"). Purpose: *"what did I pay myself in October on this obra"* in two taps.
**GAS-04** List row: title = provider, else note, else category; second line = note (if not the
title) · category · date; camera icon if it has a file; badge "Pagué yo"; amount. Empty states
("Sin gastos todavía" / "Nada con ese filtro").
**GAS-05** "Añadir gasto o factura" form: obra select (only if > 1 obra), photo/PDF (optional;
images are compressed client-side to ≤ 1600 px JPEG q 0.75; PDF ≤ 10 MB), provider selector,
amount (> 0), category, date (max today), note ("Nota (opcional)"), and — **owner only** —
"¿Quién lo pagó?". Categories: Material, Maquinaria / alquiler, Combustible, Mano de obra
externa, Sueldos, Gestión de residuos, Otros. Saving into another obra shows "Guardado en «obra»".
**GAS-06** Provider selector: favourites first ("★ Favoritos"), then "Otros", then "+ Otro
proveedor…" (free text), with a star toggle "Añadir a favoritos / En favoritos · quitar".
Case-insensitive de-duplication; the provider list is per company; seeded favourites: Leroy
Merlin, Obramat, BigMat.
**GAS-07** Detail sheet: title/amount/category/date, "Pagué yo" badge, file viewer (signed URL, image
or PDF); **Cambiar** (edit everything, replace the file — the old file is deleted unless it is a
shared legacy file) and **Borrar** (two-step). Expenses paid by the owner show a lock and no
actions for non-owners ("Lo pagó el dueño: solo él puede cambiarlo.").
**GAS-08** Storage: bucket `facturas`, path `{obra_id}/gastos/{uuid}.{jpg|pdf}`.

---

## 9. Money (`/dinero`) — owner and manager only

**DIN-01** Site leads see "Solo para el dueño y el manager" and nothing else.
**DIN-02** *Obra card*: "Cobrado del cliente"; "Recibido del jefe (esta obra)" (owner, module ON, only
if > 0); "Gastado"; result "La obra va en positivo / negativo" with signed amount;
budget line "Presupuesto del plan · X" + "% gastado" bar. Formula in v1's Money screen:
`balance = cobros + entregas tagged to this obra − all expenses of the obra` (owner);
managers cannot read `entregas`, so for them it is `cobros − gastos`. **See Q-01.**
**DIN-03** *Owner's cash box* (owner only, module `caja_jefe`): "Me ha dado el jefe" (all
`entregas`, all obras) − "He pagado yo" (all expenses with `pagado_por = personal`, all obras)
= "Me quedan para gastos" (positive) or "La empresa me debe" (negative, shown as a positive
amount). Plus "Lo que he pagado yo, por obra".
**DIN-04** Tabs "Del cliente" / "Del jefe" (the latter only with the cash box). *Client payments*:
list (concept or "Pago del cliente", date, amount, file icon), add form (amount > 0, date,
optional concept, optional proof photo/PDF), detail with proof viewer and two-step delete.
*Boss money*: list, add form (amount, date, concept, **optional** obra — "— En general, no de
una obra —"), two-step delete. Boss money is **general by design** (the boss gives it to the
person, not to an obra); the obra tag is optional.
**DIN-05** All sums are done in **cents** (`lib/dinero.ts`) — never with floating euros.

---

## 10. Planning (`/planificacion`)

**PLA-01** Hero "Avance de la obra" (same weighted % as HOM-02) + "{hechas} de {total} tareas terminadas
· N con retraso" (or "Todavía no hay plan"). Buttons "Añadir tarea" and "Desde Excel".
**PLA-02** Card: "Del {desde} al {hasta}", total days, "Presupuestado" (sum of task budgets), the Gantt.
**PLA-03** Gantt: month scale, a **"Hoy"** marker, one bar per task laid out in **percentages of the
width** (the whole plan fits the screen — no horizontal scrolling, a hard rule), progress fill,
state by colour **and text**: Terminada (100 %) / En marcha / Retrasada (end passed, < 100 %) /
Pendiente; each row shows name, %, state, dates, duration. Tap a task → edit sheet.
**PLA-04** Task form: name, start, end (end ≥ start, with the live duration), progress 0–100 (slider step
5 **and** quick buttons 0/25/50/75/100), optional budget, save, two-step delete.
**PLA-05** Excel import ("Traer el plan del Excel"): file picker (`.xlsx`); the plan is read from the
**painted cells** under week columns (`WEEK 1 16.03-20.03` …), because these Gantts store no
dates; also supports weeks with "/", real dates, chapter markers FASE/ZONA/PARTIDA/loose
numbers, amount columns AMOUNT/IMPORTE/TOTAL on the same or next row; without chapters each
job becomes a task. Preview before saving: sheet name, number of chapters, **year selector
(−/+)** because the file has no year (guessed so that week 1 starts on a Monday), chapters
with dates / lines / amount, total budget, warnings, and — if tasks exist — a "replace
existing" checkbox. Link to download the template `/plantilla-plan-obra.xlsx`. The spreadsheet
library is loaded lazily (it is ~1 MB).
**PLA-06** Errors from the DB are shown, never swallowed.

---

## 11. Vehicles (`/vehiculos`)

**VEH-01** *No kilometres anymore* (they cannot be read reliably). A usage record is **vehicle + day +
obra** (+ optional driver, + optional note "¿Dónde más tuvo que ir?"). One vehicle can go to
**several obras the same day**; the same (vehicle, day, obra) cannot repeat ("Ese coche ya
está apuntado en esa obra este día.").
**VEH-02** Day navigation; counter "N coche(s) en uso este día"; list of vehicles with, per vehicle,
one line per obra of that day ("obra · Lo llevó {driver}"), the current obra in bold; **all
obras** are shown, not only the current one.
**VEH-03** Tap a vehicle → sheet for that day: list of its obras (edit / remove with confirmation),
"Añadir otra obra este día"; form: driver (optional), obra, note.
**VEH-04** "Añadir vehículo" (name, e.g. "Furgoneta — 1234 ABC") for owner/manager. Workers see the
list **read-only** (including who drove).

---

## 12. Voice notes (`/notas`, module)

**NOT-01** Day navigation. One note per (obra, day). No note → "Sin nota de voz el {fecha}…" and a record
button; with a note → "Nota de este día", duration, audio player (signed URL 1 h), re-record
(replaces the old audio and deletes its file), two-step delete, hint "Si grabas otra vez,
sustituye a esta nota". **NOT-02** "Últimas notas": the 12 latest; tapping jumps to that day.
**NOT-03** Recorder negotiates the format the device supports (`webm`, `mp4`/`m4a`, `aac`, `ogg`; Safari
records mp4); permission-denied and unsupported-browser messages; elapsed-time counter.
**NOT-04** Storage: bucket `notas`, path `{obra_id}/{uuid}.{ext}`.

---

## 13. Summary (`/resumen`)

**RES-01** Month navigation (previous/next, "Mes actual", next disabled on the current month) and
section chips **Trabajadores / Vehículos / Gastos** (they wrap into lines; never a horizontal
scroller). **RES-02** "Exportar este mes a Excel": downloads `<obra> - <month>.xlsx` with sheets
Horas (worker, date, in, out, hours, overtime, corrected, confirmed, outside the obra),
Gastos, Vehículos (if any), Correcciones (if any) — built from the data already on screen.
**RES-03** Workers: one row per worker (days, overtime pill, "N sin salida", total hours); tap → sheet
with the worker's whole month **across all obras** (weekday, obra, in–out, zone note, hours,
overtime) and totals. **RES-04** Vehicles: days used per vehicle in this obra; tap → sheet with the month
across all obras (day, obra, driver · note). **RES-05** Expenses: month total + "Pagado por ti", then
one card per category (icon, total, count, date range, % bar) → tap → that category's expenses
with the receipt viewer.

---

## 14. Settings (`/ajustes`)

### 14.1 Gestor variant

**AJU-01** Language selector (all). Owner only, in this order: **Accesos**, **Soporte**, **Jornada**,
**Jefe de obra**, **Módulos**. Owner + manager: **Obras**, **Trabajadores**, **Vehículos**.
Site lead: language + logout only. Mobile logout button at the bottom.
**AJU-02** *Accesos*: the **invitation link** `<origin>/login?empresa=<company code>` with a copy
button; "Esperando tu aprobación (N)" list; active members (role label, obra for site leads;
you cannot open yourself). Member sheet: **role** among Dueño / Manager / Jefe de obra /
Trabajador (descriptions shown; picking a role other than site lead clears the obra),
"Obra que lleva" for site leads, "Ficha de trabajador" for workers (pick an existing card or
"Crear ficha «{nombre}»"), "Dar acceso" / "Suspender acceso", and "Eliminar de la lista"
(two-step). Nobody can raise their own level (DB-enforced).
**AJU-03** *Soporte*: e-mail of an already-registered account + hours (1–720, default 24) →
`dar_acceso_soporte(email_soporte, horas)`; list with status activo/caducado/revocado, expiry,
"Quitar ya" → `revocar_acceso_soporte(acceso_id)`. It expires by itself.
**AJU-04** *Jornada*: hours of a normal workday (1–24, step 0.5). **AJU-05** *Jefe de obra*: switch "can see
all obras" (`jefe_ve_todas`). **AJU-06** *Módulos*: five switches with descriptions (§1.3).
**AJU-07** *Obras*: every obra (tap = make it current and go Home, active or closed); active/closed
toggle; owner only: ✎ "Ubicación y horario" sheet — location via "Usar mi ubicación actual",
radius (m, default 150, min 20), start-of-shift time (optional) and minutes allowed before
(default 30; only asked when a start time is set) —
and 🗑 "Borrar obra" sheet. Add obra inline.
**AJU-08** *Delete obra* (irreversible, owner only): shows what is lost; requires typing the exact obra
name **and** the account password (re-authenticates); removes Storage files first (`facturas`
and `notas` buckets), then RPC `eliminar_obra(p_obra_id)` (one transaction). v2 must keep this
double lock.
**AJU-09** *Trabajadores* / *Vehículos*: lists with Activo/Baja toggles and inline add. **Never hard-delete
a worker** (deleting would take their hours with it); deactivate instead.

### 14.2 Worker variant

**AJU-W1** "Mi cuenta" card (name, e-mail, role label, hint "díselo al jefe"), language, logout.

---

## 15. Platform admin (`/admin`)

Separate layout with **no** company providers or menus; guard: RPC `soy_admin_plataforma`;
a signed-in non-admin sees "Esto no es para esta cuenta" + logout.

**ADM-01** "Todas las empresas": count; per company name, creation date, members, obras, company code,
subscription state in one phrase + colour (Bloqueada / Sin caducidad / Caducada el … /
Activa hasta … (N d)), the alta code it came from; actions "+1 mes" (adds a month to the expiry,
or to today if expired), "Bloquear" (with confirmation, "no se borra nada") / "Desbloquear" →
RPC `establecer_suscripcion`.
**ADM-02** "Códigos para empresas nuevas": create (optional note; the new code is **copied
automatically**), free codes with copy and cancel (with confirmation); card-paid codes show the
buyer's e-mail; "Usados y cancelados" history (code → company, date).
**ADM-03** "Errores de la app": last 100 errors (time, browser vs server, company/e-mail, message, route;
expandable detail), "Vaciar la lista" (with confirmation); they auto-expire after 90 days.
**ADM-04** "Actualizar" button.

---

## 16. Platform-level behaviour

**PLT-01** *Three languages*: `es` (source), `uk`, `en`. Auto-detected from the phone (`uk`/`ru` → uk;
`es`/`ca`/`gl`/`eu` → es; `en` → en; default es), switchable by hand, stored in cookie `idioma`
(1 year) so the very first server render is already correct. All user text goes through
`tr()` / `trN()` (plural, Ukrainian has 3 forms) / `trJsx()` (inline JSX pieces). Dates and
money use the active locale. `scripts/claves-i18n.js` lists missing translations.
**PLT-02** *PWA*: manifest (standalone, icons 192/512 + Apple touch icon, theme colour),
`appleWebApp` with a translucent status bar, `viewport-fit=cover`. The service worker only
exists to make the app installable: it **never caches page navigations**, deletes old caches on
activation, and caches same-origin static GETs network-first.
**PLT-03** *Error logging, no third parties*: browser errors (`instrumentation-client.ts`,
`app/error.tsx`, `app/global-error.tsx` → `lib/errores.ts`) and server errors
(`instrumentation.ts`) are sent to RPC `registrar_error` (rate-limited, truncated). Noise like
"ResizeObserver loop" / "Failed to fetch" is ignored; max 20 per page.
**PLT-04** *EU hosting*: `vercel.json` pins functions to `dub1` (Dublin), next to the EU Supabase
project. No analytics, no trackers, no external scripts; fonts self-hosted through `next/font`.
**PLT-05** *Data safety*: obras/workers/vehicles/providers/cash/settings cannot be deleted by cascade
(`ON DELETE RESTRICT`); obras are *closed*, workers/vehicles are *deactivated*; the only
destructive path is AJU-08.
**PLT-06** *Isolation between companies*: every company-level row carries `empresa_id`; the RLS and
the helper functions (`mi_empresa_id()`, `mi_rol()`, `puede_ver_obra()`, `puede_gestionar_obra()`,
`has_obra_access()`) enforce it. Expired/blocked subscriptions and expired support grants make
`mi_rol()` / `mi_empresa_id()` return NULL, so the company's data stops being readable.

---

## 17. Data contract (do not change)

**Tables used by the client:** `obras`, `trabajadores`, `vehiculos`, `fichajes`, `fichajes_historial`,
`usos_vehiculo`, `gastos`, `proveedores`, `cobros`, `entregas`, `tareas`, `notas_audio`,
`ajustes`, `miembros`, `empresas`, `soporte_accesos`. Not used by the app: `facturas` (legacy copy).
Only through RPC: `admins_plataforma`, `codigos_alta`, `errores_app`.

**`ajustes` (one row per company):** `jornada_horas`, `jefe_ve_todas`, `mod_vehiculos`,
`mod_notas_voz`, `mod_caja_jefe`, `mod_transporte`, `mod_geolocalizacion`.

**RPCs used by the browser:** `soy_admin_plataforma`, `guardar_mi_nombre(nuevo)`,
`confirmar_aviso_control(version)`, `comprobar_codigo_registro(p_codigo)`, `avance_obra(o_id)`,
`eliminar_obra(p_obra_id)`, `dar_acceso_soporte(email_soporte, horas)`,
`revocar_acceso_soporte(acceso_id)`, `registrar_error(p_origen, p_mensaje, p_detalle, p_ruta,
p_navegador)`, admin: `listar_empresas_admin`, `listar_codigos_alta`, `listar_errores_admin(p_limite)`,
`crear_codigo_alta(p_nota)`, `cancelar_codigo_alta(p_id)`, `establecer_suscripcion(p_empresa,
p_activa_hasta, p_bloqueada)`, `borrar_errores_admin`.
**RPCs used by the server only (service role):** `registrar_pago_alta(p_session, p_email,
p_customer, p_subscription, p_pagado_hasta)`, `actualizar_pago_suscripcion(p_subscription,
p_pagado_hasta)`.

**Triggers:** `on_auth_user_created` → `crear_miembro` (code-driven company creation / joining),
`proteger_horas_fichaje`, `validar_hora_fichaje`, `proteger_pagado_por_mi`,
`registrar_historial_fichaje` (AFTER), `registrar_correccion_fichaje`.

**Storage:** private buckets `facturas` (receipts, invoices, client-payment proofs) and `notas`
(audio). Path convention `{obra_id}/…` — the policies read the first path segment, so **never
change it**. Files are shown through signed URLs.

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
`STRIPE_WEBHOOK_SECRET`. The anon key is public by design; RLS is the protection.

---

## 18. State catalogue (what your gallery must be able to show)

For **every** screen above, design and build each applicable state:
loading · empty · populated · long text (the longest of es/uk/en per label — see T-39) · error ·
offline · "module OFF" variants · each actor that sees it differently · pending/"enviando" ·
read-only (locked) variants · confirmation steps (two-step delete) · success confirmations ·
very small phone (320 px) and desktop (≥ 1280 px).

---

## 19. Open questions for the owner (do NOT change behaviour; report and keep v1)

* **Q-01 — Two balance formulas.** Home shows `cobrado − gastado`; the Money screen shows
  `cobrado + recibido del jefe (esta obra) − gastado` for the owner (a later decision). The numbers
  can disagree. Default: keep both as in v1 and flag it; propose unifying on the Money formula.
* **Q-02 — Offline stamps get the *delivery* time.** The queue keeps the phone's time but the
  server overwrites it with its own clock (FIC-02), so a stamp tapped at 07:58 without signal and
  delivered at 09:10 is recorded as 09:10. This undermines the offline feature on a real
  site. Fixing it needs a **DB rule change** (not a UI change): do not attempt it; document it.
* **Q-03 — Workers can read the worker-name list** (needed to show drivers). Older docs say a
  worker sees only themself. Keep v1 DB behaviour; confirm with the owner.
* **Q-04 — Product name** is a working title ("Control de Obra"). Do not rename. A wordmark may be
  designed but the text stays.
* **Q-05 — Logo.** The current triangle emblem may be replaced by your proposal; the owner decides.
* **Q-06 — "Días" tile on worker Home** counts rows of the month including rows without hours.

---

## 20. Things v1 does wrong (fix in v2 without changing any rule)

1. Obra picker shows "Nueva obra" to roles that cannot create obras (SHL-04) → show only to owner/manager.
2. "Añadir trabajador" in the crew view is shown to every gestor although the DB allows only
   owner/manager (FIC-15) → align the UI with the DB.
3. i18n gaps: the labels "Cobrado", "Gastado", "Balance" on Home, the raw status words
   (`activo`/`caducado`/`revocado`, `cancelado`) and "Hasta {date}" in Support/Admin, hard-coded
   `es-ES` dates (`fmtCambio`, admin `fecha()`), the `/alta` price formatting, and the Excel export
   headers are not translated → route them through `tr()`/locale (the Excel *file* may stay in
   Spanish, but say so in the report).
4. `README.md`, `TRASPASO.md`, `RESUMEN-APP.md` are out of date → your v2 `README.md` must be correct.
5. **Quality baseline of v1 (measured 2026-11-14) — do not inherit it:**
   * `npm run lint` → **4 errors**: three `no-require-imports` in `scripts/claves-i18n.js` (fixed by
     the allowed `eslint.config.mjs` edit, see MASTER-PROMPT §5(d)) and one `react-hooks/purity` in
     `components/ajustes/SoporteAcceso.tsx` line 64 (`Date.now()` called during render to compute
     the grant status) → compute time-dependent values in an effect/event or from state, never in render.
   * `test-fechas.ts` and `test-importar-excel.ts` **do not start** natively (alias `@/` — see T-45);
     `test-importar-excel.ts` also has one stale expected total (84743 → 85706).
   * Nothing else is known broken: `npm run build` passes and i18n is 557/557 for uk and en.
