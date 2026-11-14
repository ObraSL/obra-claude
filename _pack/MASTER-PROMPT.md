# MASTER PROMPT — Control de Obra v2

**Two agents. Two independent complete builds. One winner.**
Written 2026-11-14 against reference commit `4ed79ad` (2026-09-30).
This document is addressed to **you, the agent**. Read all of it, then the two companion files,
before doing anything else.

---

## 0. Orientation

You are **Agent A** or **Agent B** (the owner tells you which in her launch message; if she did
not, ask before starting). Another agent receives the **identical** brief and builds its own
version in parallel. The owner will compare the two finished products and keep the better one.

You are building **Control de Obra v2**: the complete product — brand-new visual identity and
interface **and** the full working technical system — for a real construction company in Spain.
v1 already exists and works in production. Its **structure** is good and is to be kept
**exactly**; its **look** is to be thrown away and invented again from zero.

| File (in `_pack/`) | Read it for |
|---|---|
| `MASTER-PROMPT.md` (this) | rules, process, deliverables, definition of done |
| `ESPECIFICACION-ESTRUCTURA.md` | **the frozen structure**: every screen, role, rule, flow, data contract, with IDs |
| `TRAMPAS-Y-LIMITES-TECNICOS.md` | the traps and hard device limits that already cost real time |
| `PARA-MARIA.md` | the owner's own launch/judging guide (Ukrainian); you may read it, you do not need it |
| `herramientas/` | `alias-loader.mjs` + `correr-tests.mjs`: the verified way to run the tests (§4.1) |

**Languages.** This brief is in English. Code and code comments: **Spanish** (the v1 convention).
User-visible text: Spanish source strings inside `tr()` with Ukrainian and English dictionaries
(see §8). Everything you say **to the owner** (questions, reports): **Ukrainian**, short, plain,
no jargon — she is not a programmer. Technical deliverables may be English.

**The owner** runs a small construction company; she writes Spanish and Ukrainian, often by
voice, so her messages can contain transcription errors and half sentences. Repeat back what you
understood before acting on anything ambiguous. She decides business questions; you do not.

---

## 1. The contest

* **C-1 Isolation.** You never read, list, open, search or copy from the other agent's workspace
  (`D:\obra-v2-<the other letter>`). If you notice it, do not look inside; tell the owner.
* **C-2 Same inputs, same rules, same deliverable shape** (§10) so the owner can compare fairly.
* **C-3 Original work.** Do **not** reuse v1's visual identity: no cream background (`#f7f3ec`),
  no orange/amber accent, no Barlow Condensed + Inter + JetBrains Mono set, no floating dark
  capsule bottom bar, no "big number + gradient halo" hero card, no triangle logo. Pretend you have
  never seen v1's *look*; you read v1 only for **structure**. Do not copy any third-party design
  (Dribbble etc.); use only assets you create or that are free for commercial use with a
  recorded licence.
* **C-4 The winner is decided by the owner**, on: (a) functional parity (a **gate** — incomplete
  parity cannot win), (b) how good, clear and memorable it is on a phone, (c) honesty and quality of
  the handover. See `PARA-MARIA.md` for how she will judge. You do not judge yourself.
* **C-5 No sabotage, no peeking, no padding.** Effort goes into the product.

---

## 2. Absolute rules — NEVER

| # | Never |
|---|---|
| N1 | **Touch production.** Not the Supabase project `dfeclxjrmcrdgjhaoowp`, not the Vercel project `control-de-obra` or its domains (`control-de-obra-*.vercel.app`), not the GitHub repo `benedicimus17/control-de-obra-1`. Do not even *read* production data (it is real people's personal data). |
| N2 | **Handle the owner's credentials.** Never ask for, type, store, guess or commit passwords, tokens or keys of her accounts. She logs in herself. Test secrets she hands you for a **dev** project go only in your git-ignored `.env.local`. |
| N3 | **Spend money or create paid/real resources** without her explicit yes: new Supabase projects, Vercel upgrades, Stripe *live* mode, domains, paid APIs. Stripe **test** mode only, and only with keys she gives you. |
| N4 | **Use real personal data.** Seed data is synthetic (fake names, `*.invalid` e-mails, fake amounts). |
| N5 | **Modify v1.** `D:\obra` is read-only for you (another session may be working in it). Take your own snapshot (§4) and work from that. |
| N6 | **Weaken a permission to make a screen work.** Security lives in RLS and triggers; the UI mirrors it. If a screen "needs" a looser policy, the screen is wrong. |
| N7 | **Change a frozen rule or invent a feature.** If you think a rule is wrong, report it (§9); keep v1's behaviour. |
| N8 | **Claim something works if you did not run it and see it work.** Say what you could not verify. |
| N9 | **Push to any remote or deploy** unless the owner explicitly asks. Your repo has no remote. |
| N10 | **Delete or overwrite anything outside your own workspace.** |
| N11 | **Add trackers, analytics, third-party scripts, remote fonts/images at runtime**, or send user data anywhere. EU/GDPR customers. |
| N12 | **Reword an existing Spanish UI string** (it is an i18n key — see T-38). |

---

## 3. Frozen vs free

### FROZEN — reproduce exactly
1. **Information architecture**: the set of screens, what each shows, which actions it offers, **who**
   sees/does what (role × module matrix), and where each function can be reached from.
2. **Every business rule and formula** in the specification (hours, overtime, money, progress,
   geofence, offline queue, notices, subscription gating…).
3. **The database**: `supabase/schema.sql` is applied **unchanged**; same tables, RPC names and
   parameters, triggers, policies, Storage buckets and path conventions.
4. **Auth and onboarding flows**, billing, support access, platform admin.
5. **i18n**: three languages, Spanish source text as key, existing dictionaries, detection + cookie.
6. **PWA / offline behaviour**, pull-to-refresh, error logging, EU region.
7. **The stack**: Next.js 16.3.4 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4,
   `@supabase/ssr`, Stripe, SheetJS. Same env var names.
8. **Every hard device limit** in `TRAMPAS-Y-LIMITES-TECNICOS.md`.
9. **All existing tests pass** (through the runner, §4.1; the single stale number of §5(d) is the only edit).

### FREE — yours to invent
Visual identity (name treatment, mark, colour, type, spacing, radii, elevation, iconography,
illustration, imagery), layout, **the form of navigation**, component shapes, micro-interactions,
motion, how loading/empty/error/offline states look and read, the look of data visualisations
(progress figure, hours chart, Gantt, money figures), an optional dark theme (if you do it, do it
completely), and the **internal organisation of the application code**.

*Presentational additions only* (a splash, an illustration, a transition) are fine. Purely
functional labels (an `aria-label`, a state name such as "Enviando…") are fine **with** uk/en
translations. Anything that adds a **function, field, screen, setting, rule, or instructional /
marketing copy that carries meaning** needs the owner's approval first.

---

## 4. Workspace and setup (do this first, exactly)

Your letter is `<X>` (`A` or `B`).

```powershell
# 1) Your private workspace — a NEW folder, outside the v1 repository
New-Item -ItemType Directory -Force "D:\obra-v2-<X>\_ref-v1","D:\obra-v2-<X>\_pack" | Out-Null

# 2) A frozen copy of v1 at the reference commit (v1 itself keeps changing)
git -C D:\obra archive --format=zip -o "$env:TEMP\ref-<X>.zip" 4ed79ad
Expand-Archive "$env:TEMP\ref-<X>.zip" "D:\obra-v2-<X>\_ref-v1" -Force

# 3) A copy of this pack
Copy-Item D:\obra\rediseno\* "D:\obra-v2-<X>\_pack\" -Recurse -Force

# 4) Your own git repository (no remote, ever)
git -C "D:\obra-v2-<X>" init -b main
```

Add `_ref-v1/`, `.env*`, `node_modules/`, `.next/` to your `.gitignore`. After step 3 you work only
inside `D:\obra-v2-<X>`. If your tool can only see its working folder, tell the owner to add
`D:\obra` as an extra read-only folder, or to copy the pack and the snapshot in for you.

The reference sources are in `_ref-v1/`. **`_ref-v1/TRASPASO.md`, `RESUMEN-APP.md`, `README.md`
are outdated — ignore them.** `ESTADO-27-09-2026.md` and `plan-masshtabuvannya/` are project-
management history (a scaling plan, may or may not be present), not specification. Skip `legacy/`.

### 4.1 Tooling and commands
* Node 24.x, npm 11.x. Windows 11: PowerShell and Git-Bash both exist (T-42).
* `npm run build` (compiles **and** type-checks), `npm run lint`, `npm run dev`, `npm start`.
* **Tests — use the provided runner:** `node _pack/herramientas/correr-tests.mjs` (it runs the five
  TypeScript tests and `scripts/claves-i18n.js`). **Do not call `node scripts/test-xxx.ts` directly:**
  in v1 two of them (`test-fechas`, `test-importar-excel`) do not even start, because the modules
  they import use the `@/` alias, which Node's native TypeScript cannot resolve (T-45). The runner
  uses `_pack/herramientas/alias-loader.mjs`, which fixes that **without touching any golden
  module**. Copy both files into your project's `scripts/` if you prefer; keep them working.
* **Measured v1 baseline** (2026-11-14, so you know what "green" means): `test-horas`,
  `test-fechas`, `test-gantt`, `test-dinero` pass through the runner; `test-importar-excel` fails on
  **one stale expected number** (total `84743` → the importer now correctly finds `85706` after
  the intentional improvement in commit `e9c7d33`; verified that updating this single value makes
  it pass); i18n 557/557 translated for both languages; **`npm run lint` fails with 4 errors**
  (see spec §20.5). v2 must be fully green.
* **Read `node_modules/next/dist/docs/` before writing Next.js code.** This is not the Next.js
  you know (T-21).

### 4.2 Database environment (you never use production)
Preferred, in this order:
1. **Local Supabase** (Supabase CLI + Docker): free, isolated, safe. Apply `supabase/schema.sql`.
2. A **dev** Supabase project that the owner creates and whose URL + anon key (and, only if you
   must seed users, the dev service-role key) she puts in your `.env.local`. You do not create
   projects (N3).
3. No database yet: build against **fixtures** (see §6) and finish the database-backed
   verification when an environment exists. Say clearly in the report what that left unverified.

If you hold Supabase management tools, use them **only** on the dev project the owner names.
Seed with a script (`scripts/seed-dev.*`) that creates **two companies** with an owner, manager,
site lead, worker and a pending account each, using `*.invalid` e-mails, so isolation can be tested.

### 4.3 Stripe
Implement exactly as specified. Verify with Stripe **test** keys only if the owner provides them;
otherwise verify the "billing not available" state and unit-test `pagadoHasta`.

---

## 5. How to port: "golden" modules and the rebuilt layer

**Golden modules — copy them byte-for-byte from `_ref-v1/` and keep the same paths** (so the
unchanged tests keep working):

`lib/horas.ts`, `lib/dinero.ts`, `lib/gantt.ts`, `lib/importar-excel.ts`, `lib/format.ts`,
`lib/gastos.ts`, `lib/geo.ts`, `lib/image.ts`, `lib/modulos.ts`, `lib/offline-fichajes.ts`,
`lib/exportar-excel.ts`, `lib/eliminar-obra.ts`, `lib/errores.ts`, `lib/pagos.ts`, `lib/types.ts`,
`lib/i18n/index.ts`, `lib/i18n/provider.tsx`, `lib/i18n/uk.ts`, `lib/i18n/en.ts`, `lib/supabase/*`,
`proxy.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `public/sw.js`, `vercel.json`,
`supabase/**`, `scripts/**`, `public/plantilla-plan-obra.xlsx`, `eslint.config.mjs`,
`tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `package.json` (only **additions**).

Allowed edits to golden files: (a) **append** new strings to `uk.ts`/`en.ts`; (b) colours in
`public/manifest.webmanifest`/`viewport.themeColor` and the **app icons** (`public/icons/*`,
`app/favicon.ico`, Apple touch icon — generated from your own mark; `scripts/generar-iconos.mjs`
may be adapted) for your identity; (c) fixing a v1 defect from
`ESPECIFICACION-ESTRUCTURA.md` §20 *if it does not change a rule*; (d) the **two verified
baseline fixes**: in `scripts/test-importar-excel.ts` change the expected total `84743` → `85706`,
and in `eslint.config.mjs` add `scripts/**` to the ignored paths (the golden `claves-i18n.js` uses
`require`, which the lint rules forbid); (e) anything else unavoidable.
**Every** other difference is listed, with the reason, in `ENTREGA/cambios-en-dorados.md`, and
`ENTREGA/dorados-checksums.md` lists the SHA-256 of each golden file in v1 and v2 (they must match
except for the logged edits: `Get-FileHash -Algorithm SHA256`).

**Rebuilt layer — yours to write, behaviour frozen:** `app/**` routes and pages, `components/**`,
`lib/miembro-context.tsx`, `lib/obra-context.tsx`, `lib/use-session.ts`, `lib/nav.ts` (the data
and rules are frozen, the icons are yours), the shell, gates, sheets, forms. Re-implement
**behaviour**, not code: the spec tells you what must happen; v1's pages tell you the details.
Where v1's code carries a lesson in a comment, keep the lesson.

**Port, don't reinvent.** If you are about to "improve" a rule, a formula, a query or a policy, stop:
that is N7.

---

## 6. Architecture requirements (so the design can be reviewed and tested)

* **Separate data/permissions from presentation.** Each screen has a *container* (fetches,
  permissions, actions, offline queue, errors) and *views* that only receive props. Views must
  render with **no network** from fixtures.
* **A data-access layer with two implementations**: Supabase, and in-memory fixtures. All reads and
  writes go through it. Same query semantics as v1 (e.g. `miembros` filtered by `user_id`,
  half-open month ranges, local — not UTC — dates).
* **A design gallery** at `/galeria` (and `/galeria/<screen>`): no login, fixture-driven, available
  only when `NEXT_PUBLIC_GALERIA=1` (otherwise `notFound()`; never in a production build).
  Controls: **language** (es/uk/en), **actor** (anonymous, pending, worker, site lead, manager,
  owner, platform admin, expired subscription), **module toggles**, **state** (loading, empty,
  populated, long text, error, offline), and **viewport frames** 320 / 375 / 430 / 768 / 1280. It must
  be able to show **every state in spec §18**. The owner reviews the design here, on her phone.
* **Automated QA scripts** in `scripts/` (your choice of tool, e.g. Playwright): no horizontal overflow
  at 320/375/430 on every gallery screen (T-07); every interactive control ≥ 44×44 CSS px (T-14);
  no console errors; and a screenshot sweep for the report.
* **Performance**: do not exceed v1's first-load JS on the worker flow (`/`, `/fichajes`); record
  v1's and v2's `next build` figures. No heavy animation or UI libraries unless justified in
  `ENTREGA/dependencias.md` (each new dependency: name, size, licence, why).

---

## 7. Design brief

**Who and where.** About 80 % of use is on **phones** (mostly iPhone, also Android and iPad), outdoors
on a building site: sunlight, dust, gloves, one hand, patchy 4G. Workers need to clock in in
**two taps and two seconds**. The owner and managers need dense, trustworthy information:
hours, expenses with receipts, money, plan progress. Three languages. Both audiences live in the
same product.

**What the owner asked for.** A design that is **professional, clear and memorable** — she finds v1
"boring". "Memorable" means distinctive and applied with discipline, not decorative.

**Qualities you are judged on**
1. **Clarity under stress** — the next action is obvious; primary controls are large; one thumb.
2. **Legible in sunlight** — strong contrast (AA minimum; AAA for stamp buttons and money figures),
   no thin light-grey-on-white text for anything important, no meaning by colour alone.
3. **Trust with money and time** — tabular figures, unambiguous signs, explicit "corrected / confirmed"
   states, calm and exact error messages.
4. **Resilient** — offline, loading, error, empty, long-text, three-language states are *designed*, not
   leftovers. Label length varies per language — some Ukrainian labels are ×1.9 the Spanish
   one (T-39).
5. **A real idea.** State in one sentence the concept behind your design, and define **three
   signature moments** (e.g. the clock-in tap, the money balance, the plan progress) where it is
   unmistakable. Avoid the generic "AI dashboard" look (purple gradients, glass cards everywhere,
   stock hero illustrations, interchangeable card grids).
6. **Fast** — it must feel instant on a mid-range Android on 4G (no layout shift, no jank).

**Constraints that are design's to respect** (see spec/traps for the proofs): `100dvh` and safe
areas; nothing scrolls sideways; the whole Gantt fits the width; every form's primary button stays
reachable above the soft keyboard (v1 uses bottom sheets; any pattern that passes the keyboard
test at 320×568 is fine); the anonymous landing fits one screen; the working name "Control de Obra" stays (Q-04); the logo may be
re-proposed but the owner decides (Q-05); light theme required, dark optional.

**Both audiences.** Worker screens: sparse, large, one action each. Owner/manager screens:
information-dense but scannable. One coherent system serving both is the hard part — show how.

---

## 8. Engineering rules

* **E-1 i18n.** Every user-visible string passes through `tr()` / `trN()` / `trJsx()` with the Spanish text as
  the key. Do not edit existing strings; **append** translations for any new string to `uk.ts` and
  `en.ts`; `node scripts/claves-i18n.js` must report **nothing missing**. Fix the i18n gaps listed in
  spec §20.3.
* **E-2 Errors.** Every network call has loading, error and (where relevant) offline handling. Server
  business-rule messages (e.g. "La entrada ya está fichada…") are shown to the user as returned.
* **E-3 Accessibility floor** (`TRAMPAS…` §I): semantic landmarks, labelled controls, focus states,
  `aria-live` for banners, keyboard usable on desktop, `prefers-reduced-motion`.
* **E-4 Security.** No `dangerouslySetInnerHTML` with user data. The service-role key only in server
  routes. Webhook signature verified. Never expose a secret with `NEXT_PUBLIC_`.
* **E-5 Database changes.** None expected. If you believe one is needed: do **not** change it; write the
  proposal in `ENTREGA/PREGUNTAS.md` (production will have to run v1 and v2 against the same
  database during the switch-over, so any change must stay backward compatible).
* **E-6 Commits.** Small, meaningful, one concern each, messages in Spanish. No secrets, no large
  binaries.
* **E-7 Tests.** The five TypeScript tests and the i18n check pass (through the runner, §4.1; the only
  edit allowed in them is the one stale number in §5(d)). (`test-importar-excel.ts`
  defaults to a real Gantt of the owner's company on this machine — a business document with real
  prices: reading it for the test is fine, but **never copy it into your repo, screenshots or
  reports**; use the generated template `public/plantilla-plan-obra.xlsx` for demos.) The SQL safety tests in
  `supabase/` (`prueba-choque.sql` — 41 cases, `prueba-aislamiento.sql`, `prueba-horas-dueno.sql`,
  `prueba-gastos-vehiculos.sql`) must be run on your dev database and pass; each rolls back and
  leaves no data. (Some borrow existing accounts, so run your seed script first.) Write end-to-end checks for the critical flows (clock in/out, offline queue, owner
  correction → worker confirmation, expense with "Pagué yo", role redirects) against the seeded
  dev database or the fixtures.
* **E-8 README.** Your `README.md` must be correct and let a newcomer run everything.

---

## 9. When to stop and ask the owner

Stop that line of work (continue others) and write the question in `ENTREGA/PREGUNTAS.md` **and**
tell the owner, in Ukrainian, when you need:
* a dev database, test keys, or any access;
* a decision on a business rule, or you found a **conflict between spec and code** that changes behaviour;
* anything with a **cost**, a licence doubt, or a **legal** text;
* approval for a presentational addition that carries meaning (§3);
* a real-device test only she can do.

Format — one question per message, with your recommended default:
```
[A|B] Питання: <one sentence in Ukrainian>
Чому це важливо: <one sentence>
Мій варіант за замовчуванням: <what you will do if she does not answer>
```
If she does not answer, continue with the default and log it in `ENTREGA/DECISIONES.md`.

---

## 10. Process, gates and deliverables

You may work Phase 1 and Phase 2 in any order or interleaved, but **Phase 3 needs both**. Keep
`ENTREGA/PROGRESO.md` current (what is done, what is next, blockers, exact resume steps): your
context is finite and a fresh session of you must be able to continue from that file alone.

### Phase 0 — Study (read-only)
Read the three pack files, then v1's code completely: routes, components, `lib`, `supabase/schema.sql`,
tests. Produce `ENTREGA/00-inventario.md`: your **own** inventory (routes, screens, data calls,
rules), **every discrepancy** with the spec, and the **parity matrix** skeleton
(`ENTREGA/MATRIZ-PARIDAD.md`: one row for each ID in the spec).
*Gate:* inventory and matrix skeleton complete.

### Phase 1 — Design
`ENTREGA/01-diseno/`: the **one-sentence concept** and three signature moments; principles; identity
(mark proposal, colour tokens **with measured contrast ratios**, type system **tested in es/uk/en**,
spacing/radius/elevation, iconography, motion); the component library spec (every primitive and
its states); mockups (HTML/CSS prototypes or images) of the critical screens in all required
states: public landing, login/signup, worker home, worker clocking (stamp → pending → done →
corrected-and-confirm), manager home, crew clocking + owner correction sheet, expense form + list
+ detail, money, planning/Gantt + import, settings/access. Plus `RESUMEN-UA.md` (Ukrainian,
plain, with images).
*Gate:* every screen type in the spec has a designed answer for each state in §18.

### Phase 2 — System port (headless)
Scaffold the project; port golden modules; build providers, proxy, gate chain, i18n, offline queue,
PWA, API routes, data-access layer (both implementations), seed script; build every route and
every container with **minimal unstyled** views (semantic HTML, `data-testid`s). This proves parity
independent of the design.
*Gate:* build + lint + all tests green; every route works for every actor with the unstyled
views; the SQL safety tests pass on the dev database (or are listed as pending, §4.2).

### Phase 3 — Integration
Implement the design system and apply it to every view; build the gallery; handle every state ×
actor × language × viewport; run the QA scripts.
*Gate:* gallery complete; QA scripts green; no horizontal overflow; targets ≥ 44 px.

### Phase 4 — Verification
Fill the parity matrix **with evidence for every row** (file + how you verified: test name,
screenshot, manual script). Then do an **adversarial pass**: act as each actor and try to break a
rule (stamp twice, stamp another day, open a forbidden route, read another company's data,
edit an owner-paid expense as manager, go offline mid-stamp, wrong password, expired
subscription). Fix, re-run everything. Re-read the whole spec once more, line by line.
*Gate:* no row is "unknown".

### Phase 5 — Handover
Produce the `ENTREGA/` folder (below). Final message to the owner in Ukrainian (≤ 15 lines): what is
ready, how to see it, what you could **not** verify, what you need from her.

### Deliverable layout (identical for A and B)
```
D:\obra-v2-<X>\
  (the application, runnable: npm install && npm run build && npm start)
  README.md                      correct, complete
  ENTREGA\
    PROGRESO.md                  phases, status, resume steps
    00-inventario.md             your inventory + spec/code discrepancies
    01-diseno\                   concept, identity, components, mockups, RESUMEN-UA.md
    MATRIZ-PARIDAD.md            every spec ID: status + evidence
    DECISIONES.md                every non-trivial decision and why
    PREGUNTAS.md                 questions asked / defaults taken
    cambios-en-dorados.md        every edit to a golden file, and why
    dorados-checksums.md         SHA-256 v1 vs v2 for each golden file
    dependencias.md              every added dependency: size, licence, reason
    COMO-PROBARLO.md             exact steps: install, env, seed, run, gallery URL, fake accounts, tests
    INFORME-FINAL-UA.md          Ukrainian, ≤ 2 pages, plain: ready / not verified / needs from owner
    capturas\                    screenshots: every screen in es at 375; the 12 critical screens in
                                 uk and en and at 320 and 1280
    metricas.md                  v1 vs v2: first-load JS, contrast table, overflow/target reports
```
Parity matrix row:
`| FIC-12 | Owner correction sheet | ✔ done / ⚠ partial / ✖ missing | evidence: file + how verified | note |`
A row marked ✔ without evidence counts as missing.

---

## 11. Definition of Done

All of the following, or an explicit, justified exception the owner approved:
1. **Parity**: every row of the matrix ✔ with evidence; spec discrepancies logged.
2. `npm run build` ✔ · `npm run lint` ✔ **with zero errors** (v1 itself has 4) · the five TS tests ✔
   via the runner · i18n report: nothing missing.
3. SQL safety tests ✔ on a dev database (or honestly listed as pending).
4. Golden modules identical to v1 except logged edits (checksums).
5. Gallery covers spec §18 in three languages and the five viewports.
6. QA scripts ✔: no horizontal overflow (320/375/430), targets ≥ 44 px, no console errors.
7. Offline flow demonstrated (emulated offline → "Enviando…" → delivered) and "stamp twice" blocked.
8. Contrast table, performance comparison with v1, dependency list.
9. No secrets in the repo or history; README correct; commits clean.
10. The final report lists, separately, **what was verified and how** and **what was not** (real iPhone,
    camera, microphone, geolocation, installed PWA, rubber-banding, keyboard overlap).

Done is not "mostly". If you are running out of room, update `PROGRESO.md` with precise resume
steps rather than leaving things half-finished and unreported.

---

## 12. Reminders that prevent the most expensive mistakes

* The database, not the UI, decides what a user may do. Mirror it; never replace it.
* `toISOString()` is never a calendar date (T-01). Money is summed in cents (T-31).
* Nothing scrolls sideways (T-05/T-06). Test with the keyboard open (T-08). `100dvh`, safe areas.
* A stamp shows the **server's** time (FIC-02). Offline is a first-class state (FIC-08).
* Owner-only means owner-only: correct hours, "Pagué yo", boss money, access, modules, delete obra.
* Spanish strings are keys: never reword (N12). Three languages, longest wins.
* Two-step confirmation on every destructive action, as in v1.
* Say what you did not verify.
