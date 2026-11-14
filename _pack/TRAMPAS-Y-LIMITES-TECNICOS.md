# Control de Obra — TRAPS AND HARD TECHNICAL LIMITS

Every item here **cost real time or broke something on a real phone**. They are not
opinions. A beautiful design that violates one of them is a failed design.

Legend: **[DEVICE]** only shows on a real phone · **[DB]** database · **[BUILD]** tooling.

---

## A. Dates and time

**T-01 [BUG] Never build a calendar date with `toISOString()`.** It converts to UTC; in Spain
(UTC+1/+2) midnight becomes *the previous day*. v1 shipped with "next day" doing nothing and
"previous day" jumping by two (7 → 5 → 3). Build `YYYY-MM-DD` by hand from
`getFullYear/getMonth/getDate` (see `lib/format.ts`: `todayStr`, `shiftDay`, `shiftMonth`).
`toISOString()` is only valid for real instants (`timestamptz`). Keep and run
`scripts/test-fechas.ts` (runs with `TZ=Europe/Madrid`, covers the DST days 2026-03-29 and
2026-10-25 and leap years).

**T-02 [DB] Month filters use half-open ranges.** `monthBounds(mes)` → `gte(desde)` + `lt(hasta)`.
A trick like `` `${mes}-32` `` is rejected by Postgres (HTTP 400) and screens silently show zero.

**T-03 Server time is the only valid clock for a stamp** (`Europe/Madrid`). Never trust or
display the phone's clock after a stamp; show what the server returned (FIC-02).

---

## B. iPhone / PWA layout (the phone is 80 % of the use)

**T-04 [DEVICE] Viewport.** Use `100dvh`, never `100vh` (on iPhone `100vh` is taller than what is
visible and the page bounces a few pixels, hiding the bottom bar). Keep
`viewport-fit=cover` and respect `env(safe-area-inset-top|bottom|left|right)` — without it the
translucent status bar covers the top and the home indicator covers the bottom.

**T-05 [DEVICE] No sideways movement, ever.** What finally fixed "the page drifts left/right" was the
combination: `overflow-x: hidden` **and** `overscroll-behavior-x: none` on **both `html` and
`body`** (it is `html` that rubber-bands), `touch-action: pan-y` on `body`,
`-webkit-text-size-adjust: 100%`.

**T-06 [DEVICE] Consequence: nothing in the app may require horizontal scrolling.** `touch-action:
pan-y` blocks it. v1 already broke a row of tabs this way and fixed it by letting them wrap.
Tables become cards, tab rows wrap, the Gantt is laid out in percentages of the width. If a
design needs a horizontal scroller you must first remove `touch-action`, then re-prove the
bounce is gone on a real iPhone — the owner will not accept the regression.

**T-07 [DEVICE] Flex children need `min-w-0`.** By default a flex child cannot shrink below its
content, so a wide card stretched the whole page to 467 px on a 375 px screen. Verify with
`document.documentElement.scrollWidth <= clientWidth` at 320, 375, 390, 430.

**T-08 [DEVICE] Soft keyboard.** A field + button pinned to the bottom of the screen end up *under* the
keyboard (v1: the "Ok" of "¿Quién te trajo?" could not be tapped). v1's fix was to put forms in
**bottom sheets** with the primary button reachable above the keyboard; any pattern is fine as
long as it passes the same test: **every form, with the keyboard open at 320×568, keeps its
primary button visible and tappable.**

**T-09 [DEVICE] iOS time inputs cannot be empty.** `<input type="time">` can only be cleared to `00:00`
by the user, so every optional time needs its own explicit clear control (FIC-22).

**T-10 [DEVICE] Camera/file inputs.** `capture="environment"` opens the camera; photos are huge, so they
are compressed client-side before upload (max 1600 px, JPEG q 0.75; PDFs ≤ 10 MB). Poor
coverage on site makes large uploads fail. A document-scanner step is on the roadmap
(crop/deskew/contrast) — design the capture flow so it can slot in later.

**T-11 [DEVICE] Audio.** Safari records `audio/mp4`, Chrome `audio/webm`. Negotiate with
`MediaRecorder.isTypeSupported` (see `components/ui/GrabadorAudio.tsx`). The microphone and
geolocation need a **secure context** (HTTPS or `localhost`): a LAN `http://192.168…` test
URL will not exercise them.

**T-12 [DEVICE] Standalone PWA has no browser chrome.** Every screen needs its own way back/home
(the logo returns to Home; `/login` has a back arrow).

**T-13 Safe-area for fixed bars.** The bottom bar must add `env(safe-area-inset-bottom)`; with
7 icons it overflowed narrow iPhones, hence Planning is not in the bar.

**T-14 Touch targets ≥ 44×44 CSS px** (v1 used 40 px buttons — do better; primary actions on
site, with gloves and sun, should be larger still). Colour is never the only carrier of
meaning (also text/icon).

**T-15 Test with build + start, never `next dev`, on a phone.** The hot-reload websocket reloaded the
page by itself and **destroyed what the user was typing**.

---

## C. Service worker, caching, deployment

**T-16 The service worker must NEVER cache page navigations.** v1 once did and a phone kept showing
an old login page for days. Current `public/sw.js` returns early for `request.mode ===
'navigate'`, deletes all older caches on activation and caches only same-origin static GETs
(network first). Keep it. `sw.js` must be **excluded from the proxy matcher** or its
registration fails.

**T-17 Public path `/` is compared by exact equality** in the proxy. With `startsWith("/")` every
route becomes public.

**T-18 Root layout needs `export const dynamic = "force-dynamic"`** (the whole app depends on the live
session and data; without it the build fails when the Supabase variables are missing at
pre-render time).

**T-19 Vercel region is pinned to `dub1`** (`vercel.json`) to stay in the EU next to Supabase.

**T-20 Vercel Hobby is non-commercial.** Production with paying customers needs Pro. (Business
decision for the owner; not yours to change.)

---

## D. Next.js 16 (it is NOT the Next.js you know)

**T-21** `AGENTS.md` says it and it is true: **read the relevant guide in
`node_modules/next/dist/docs/` before writing code.** Things already hit:
* `middleware.ts` is called **`proxy.ts`** (export `proxy`);
* `next lint` no longer exists → `npm run lint` runs `eslint` directly;
* `params` / `searchParams` are asynchronous;
* typed helpers such as `LayoutProps<"/">` exist and are used;
* `instrumentation.ts` (`onRequestError`) and `instrumentation-client.ts` are used for error logging;
* Tailwind **v4**: tokens are CSS variables in `@theme` inside `app/globals.css`; there is **no**
  `tailwind.config.js` — do not create one.
* `components/…` using hooks need `"use client"`; pages that call `useSearchParams()` must be
  wrapped in `<Suspense>` (see `app/login/page.tsx`).

**T-22 [BUILD] Lint rule `react-hooks/set-state-in-effect` is disabled on purpose**
(`eslint.config.mjs`): loading data on mount inside an effect is the accepted pattern here.

**T-23 [BUILD] `tsconfig.json` excludes `scripts/`.** The tests run with Node 24's native TypeScript
and import with the `.ts` extension, which the compiler rejects (TS5097).

**T-45 [BUILD] Node-native tests cannot resolve the `@/` alias or extensionless imports.** Since the
i18n commit, `lib/format.ts` and `lib/importar-excel.ts` import `@/lib/i18n`, and
`lib/i18n/index.ts` imports `./uk` and `./en` without extension. Next/TypeScript accept that;
Node says `Cannot find package '@/lib'`. Result in v1: `test-fechas.ts` (the guard against the
UTC date bug, T-01) and `test-importar-excel.ts` silently stopped running, and nobody noticed.
Also, under Node `import "xlsx"` loads the CommonJS build, which lacks `XLSX.SSF`
(`reading 'parse_date_code'`); the browser bundlers use the ESM build.
**Fix without editing any golden module:** run tests through
`node _pack/herramientas/correr-tests.mjs` (uses `alias-loader.mjs`, a `module.registerHooks`
resolver). **A test suite that cannot run is the same as no test suite — run it every time, and
make the runner part of your CI-style routine.**

---

## E. Database and security

**T-24 [DB] Permissions live in the database, not in the UI.** RLS policies + triggers are the
authority; the UI only hides what would be rejected. Never "fix" a screen by loosening a policy.
`supabase/schema.sql` is idempotent and is the only source of the schema.

**T-25 [DB] Always filter `miembros` by `user_id`.** The owner can read every member row, so an
unfiltered `.maybeSingle()` returns several rows, fails, and **locks the owner out of their own
app** (it showed the "pending approval" screen).

**T-26 [DB] NULL role pitfall.** `mi_rol()` returns NULL for accounts with no access (pending,
expired subscription, expired support grant). `mi_rol() <> 'dueno'` is *not true* for NULL, so
owner-only checks let NULL pass. Use `IS DISTINCT FROM`. Found by an outside test on 2026-09-30.

**T-27 [DB] Reading the subscription state must not go through `mi_empresa_id()`** (it returns NULL
exactly when the subscription is expired). The `empresas "empresas propia"` policy exists for
this and `MiembroProvider` reads `empresas` directly.

**T-28 [DB] History trigger must be AFTER, not BEFORE.** A BEFORE trigger wrote the history row before the
fichaje existed and violated its foreign key when correcting an existing row.

**T-29 [DB] No cascades.** Obras, workers, vehicles, providers, boss-money and settings use
`ON DELETE RESTRICT`. The only way to remove an obra is RPC `eliminar_obra` (one transaction),
**after** the client removes its Storage files (SQL cannot delete Storage objects).

**T-30 [DB] Never create "ghost" fichajes** (a row with no entry and no exit): they collide when
moving a stamp to another obra on the same day.

**T-31 Money is summed in cents.** `0.1 + 0.2 = 0.30000000000000004`; use `lib/dinero.ts`.

**T-32 Never ship secrets.** `.env*` is git-ignored. `SUPABASE_SERVICE_ROLE_KEY` is read only in
server routes (`lib/pagos.ts`), never with a `NEXT_PUBLIC_` prefix. The Stripe webhook must
verify the signature.

**T-33 Don't paste SQL into Supabase's Monaco editor by typing.** Auto-indent inflated 7 000
characters to 35 000. Use `monaco.editor.getEditors()[0].setValue(sql)` and compare lengths.
The editor also asks to confirm destructive statements and tables created without RLS.
(Applies when automating the owner's logged-in browser; local/dev databases use the CLI.)

---

## F. Excel

**T-34 Painted-cell Gantts.** The plan importer reads colours, not dates. With SheetJS you **must**
pass `{ cellStyles: true, sheetStubs: true }`; without `sheetStubs` empty-but-painted cells (the
bars!) do not even appear.
**T-35** In Node/ESM use `XLSX.read(readFileSync(path))` — `XLSX.readFile` does not exist when the
package is imported as an ES module. In the browser `leerArchivoExcel(File)` is used.
**T-36** SheetJS weighs ~1 MB: **load it lazily** where the user imports a plan (v1 does
`await import("@/lib/importar-excel")`). The export screen imports it statically — v2 should
make that lazy too.
**T-37** The year is not in the file; it is guessed so that week 1 starts on a Monday and can be
changed by hand. A real file of the owner is used by `scripts/test-importar-excel.ts`.

---

## G. i18n

**T-38** The Spanish source text **is the key** (`tr("Corregir horas")`). Changing a Spanish string
silently drops its Ukrainian/English translation (the app falls back to Spanish). Never
reword; if you must, update `uk.ts` and `en.ts` in the same change and run
`node scripts/claves-i18n.js` (it must report nothing missing).
**T-39** Text length differs **label by label**, not on average. Measured on the v1 dictionaries
(~480 strings): on average Ukrainian ≈ Spanish (×1.02) and English is a bit shorter (×0.92),
**but** 46 % of Ukrainian labels and 29 % of English labels are *longer* than the Spanish one, 18 %
of Ukrainian labels are ≥ 20 % longer, and the worst cases are ×1.9 (`Volver a hoy` → «Повернутись
до сьогодні»), ×1.8 (`No se usó este mes`), ×1.5 (`{n} sin salida` → "{n} without clock-out").
Design every button, tab, chip and table header for the **longest of the three languages for that
label** at 320 px; truncation of a *critical* label (a stamp button, a money label, a destructive
confirmation) is a defect. Never size a control to the Spanish text alone.
**T-40** Plurals: use `trN(n, "{n} día", "{n} días")`; Ukrainian needs three forms joined with `|`
in `uk.ts`. Inline bold/links inside a sentence: `trJsx("… {x} …", { x: <b>…</b> })` so the
translator can reorder the sentence.
**T-41** Language is a module-level variable and `IdiomaProvider` **remounts the whole tree** when it
changes; do not cache translated strings in module constants.

---

## H. Working on this machine (Windows)

**T-42** Windows 11, PowerShell *and* Git-Bash exist; they use different syntax. Paths with `(`…`)` such
as `app/(dashboard)/…` need quoting. Git prints "LF will be replaced by CRLF" warnings — harmless.
**T-43** Node 24.x, npm 11.x. `sharp` is a dev dependency (icon generation, `scripts/generar-iconos.mjs`).
`scripts/generar-plantilla-plan.py` regenerates the Excel template (needs Python + openpyxl).
**T-44** The Supabase and Vercel sessions of the owner expire after days; the owner re-logs in herself
(GitHub for Supabase; `npx vercel login` shows a code she confirms). You never type her password.

---

## I. Accessibility floor (not optional)

Real focus states; semantic landmarks and one `h1` per screen; every control labelled
(`aria-label` through `tr()`); `aria-live` for errors / offline banners; contrast WCAG AA for text
(AAA wanted for the stamp buttons and money figures); respect `prefers-reduced-motion`; usable
with a keyboard on desktop; no information by colour alone; tabular figures for money and hours.

---

## J. What "verified" means in this project

The owner's rule: **say plainly what you could not verify.** You cannot test on a physical
iPhone. Emulation (browser device mode) is useful but is *not* an iPhone. In the final report write
two lists: "verified, how" and "NOT verified (needs a real device)": at minimum safe-areas,
rubber-banding, keyboard overlap, camera, microphone, geolocation, installed-PWA behaviour.
