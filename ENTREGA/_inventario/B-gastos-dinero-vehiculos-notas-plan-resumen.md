# Inventory B — Gastos / Dinero / Vehículos / Notas / Planificación / Resumen (v1)

Source: `_ref-v1/` (paths below relative to it). Spec: `_pack/ESPECIFICACION-ESTRUCTURA.md`. Code wins.
All UI strings go through `tr()` / `trN()` / `trJsx()` (i18n keys = the Spanish text). `trN(n, uno, varios)` = plural pair with `{n}`.
Notation: `file:line`. "RLS" = rows are filtered by the DB, the client adds no company filter anywhere in this area.

## 0. Cross-cutting facts

* **Route access is NOT checked inside these pages** (except `/dinero`). It lives in `components/layout/AccesoGate.tsx:26-27` + `lib/nav.ts:RUTAS_SOLO_GESTORES` = `/gastos /facturas /notas /resumen /planificacion /dinero` (workers → redirect) and `lib/modulos.ts:RUTA_MODULO` = only `/vehiculos` (module `vehiculos`) and `/notas` (module `notas_voz`). **`caja_jefe` gates no route**, only UI pieces inside `/dinero`. Nav: site lead (`jefe_obra`) has `/dinero` removed (`lib/nav.ts:61`).
* No `localStorage`/`sessionStorage` in any file of this scope. No `window` events are **dispatched** here. Only listener: `obra:refrescar` (const `EVENTO` in `components/layout/PullToRefresh.tsx:7`, hook `useEnRefresco(cb)`), used by **gastos** (twice: `cargar`, `cargarProveedores`) and **dinero** (`cargar`). NOT used by vehiculos, notas, planificacion, resumen (they do not refresh on pull-to-refresh).
* Supabase client: `createClient()` memoised per page (`useMemo`). No loading/skeleton states except where noted; **load errors are ignored (data ?? [])** in gastos, dinero, vehiculos, notas, resumen; only planificacion surfaces load errors.
* Contexts used: `useObra()` → `obraActual`, `obras`, `jornadaHoras`; `useMiembro()` → `rol`, `esDueno`, `esTrabajador`, `miembro` (`.user_id`), `modulos` (`.caja_jefe`).
* Dates are `"YYYY-MM-DD"` strings, never `toISOString()` (`lib/format.ts:3-14`, `lib/gantt.ts:1-12`). Month filters use `[desde, hasta)` with `gte/lt` via `monthBounds(mes)` = `{desde:"YYYY-MM-01", hasta:"<next month>-01"}` (`lib/format.ts:66`; comment: `${mes}-32` is rejected by Postgres).
* Formatting helpers (outside scope, signatures needed): `fmtEUR(n)` (Intl currency EUR, locale of current language, `Number(n)||0`), `fmtDate(iso)` → `dd/mm/yyyy`, `fmtDateLong`, `monthLabel("YYYY-MM")` (capitalised "month year"), `shiftMonth`, `currentMonth`, `todayStr`, `weekdayShort`.

---

## 1. `app/(dashboard)/gastos/page.tsx` — GastosPage (+ inner `DetalleGasto`, `GastoForm`)
Implements GAS-01..08. Components: `ProveedorSelector`, `SelectorArchivo`, `ArchivoViewer`, `PagadoPor*`, `MonthFilter`, `Sheet`.

**Who sees what**
* `esDueno` only: (a) "¿Quién lo pagó?" selector in the form (:518); (b) `puedeTocar(g) = esDueno || g.pagado_por !== "personal"` (:114) → otherwise lock line instead of Cambiar/Borrar.
* Payload `pagado_por = esDueno ? pagadoPor : (gasto?.pagado_por ?? "empresa")` (:420) — non-owner always creates "empresa", edit keeps existing.
* Obra select only if `obras.length > 1` (:451). Filters/badge visible to everyone who reaches the route. No `gestiona`/`rol` check, no module check.

**Reads**
| When | Call |
|---|---|
| mount, obra change, `obra:refrescar` | `from("gastos").select("*").eq("obra_id", obraActual.id).order("fecha",{ascending:false}).order("created_at",{ascending:false})` (:63-68) — whole obra history, month/who filters are client-side (`g.fecha.slice(0,7) === mes`, `g.pagado_por === quien`) |
| mount, `obra:refrescar`, after each provider write | `from("proveedores").select("*").order("nombre")` (:73) — no obra filter, company scope via RLS |
| Detail viewer | storage `facturas` `createSignedUrl(recibo_path, 600)` (ArchivoViewer, §12) |

**Writes**
* Upload (only if a file chosen): `subirArchivo(supabase, obraId, "gastos", archivo)` → bucket `facturas`, path `${obraId}/gastos/${crypto.randomUUID()}.${pdf|jpg}`, `upload(path, blob, {contentType: archivo.type})` — **no `upsert`**. Upload error → `setError(tr("No se pudo subir el archivo ({detalle}).",{detalle}))`, abort (:399-404).
* Provider: `asegurarProveedor(nombre, favorito?)` (:92-106): trims; empty → `null`; case-insensitive lookup in already-loaded list (`buscarProveedor`); if found and `favorito` defined and different → `from("proveedores").update({favorito}).eq("id", existente.id)` then reload; returns the **stored** spelling. If not found → `from("proveedores").insert({nombre: limpio, favorito: favorito ?? false})`, reload, returns `limpio`. **Runs before the expense insert**, so a provider can be created although the expense then fails to save; also created immediately when the star is toggled for a typed new name. De-duplication is client-side only (no DB error handling; results of update/insert ignored).
* Insert: `from("gastos").insert(datos).select().single()`; Update: `.update(datos).eq("id", gasto.id).select().single()`, where `datos = {obra_id, concepto: nota.trim()||null, proveedor: nombreProveedor, importe: Number(importe), categoria, fecha, recibo_path, recibo_tipo, pagado_por}` (:411-421). `recibo_path/recibo_tipo` keep old values unless a new file was chosen (then new path + `archivo.type`).
* On save error (`err || !data`): remove just-uploaded file (`storage.from("facturas").remove([subido])`), show `err?.message ?? tr("No se pudo guardar el gasto. Inténtalo de nuevo.")`.
* After a successful edit with a new file: delete the old file **unless `gasto.factura_origen_id`** (shared legacy file) (:436-438).
* Delete (`eliminar`): `from("gastos").delete().eq("id", g.id)` first; on error show `err.message` in the detail sheet and stop; only after success remove the file `if (g.recibo_path && !g.factura_origen_id)` (:116-130) — i.e. DB first, then storage (opposite of dinero). Then removed from state, detail sheet closed.
* Moved to another obra on edit: item disappears from the list; viewer closes (`setViendo(null)`); on create into another obra the list is not updated (`g.obra_id === obraActual.id` check).

**Client rules**: `valido = Number(importe) > 0` (:384, button disabled); date input `max={todayStr()}` is only an HTML attribute (not validated in JS); amount `type=number min=0 step=0.01 inputMode=decimal placeholder="0,00"`; category list = `CATEGORIAS_GASTO` (Material, Maquinaria / alquiler, Combustible, Mano de obra externa, Sueldos, Gestión de residuos, Otros) plus the item's own legacy category if not in the list (:386-388); category labels rendered with `tr(c)`; saved into other obra: success line shown, `setTimeout(() => onGuardado(data), 900)` and the save button stays disabled (`!!guardadoEnOtra`); note prefill excludes `concepto` equal to proveedor or `"Factura"` (:373-375); sum via `suma()` (cents); default form date `todayStr()`, default pagadoPor `"empresa"`, default category first.

**Strings**: filter chips `Todo` / `Pagué yo` / `La empresa` (:33-37); card title `Total gastado` | `Pagado por ti` | `Pagado por la empresa` (+ ` · {monthLabel(mes)}`); count `trN(n,"{n} gasto","{n} gastos")`; `De eso, pagado por ti` (only when `quien==="todo"` and personal sum > 0); button `Añadir gasto o factura`; empty `Sin gastos todavía` / `Tickets y facturas de esta obra aparecerán aquí.` (when the obra has zero expenses) vs `Nada con ese filtro` / `Prueba con otro mes o con «Todo».`; sheets `Nuevo gasto`, `Gasto`, `Cambiar gasto`; detail `Sin foto ni PDF.`, `Cambiar`, `Borrar este gasto`, `Toca otra vez para borrarlo de verdad`, lock `Lo pagó el dueño: solo él puede cambiarlo.`; form labels `Obra`, `Foto del ticket o factura (opcional)` (becomes `Foto del ticket o factura` when editing one that has a file), `Ya tiene foto. Si eliges otra, sustituye a la de ahora.`, `Proveedor`, `Importe (€)`, `Categoría`, `Fecha`, `Nota (opcional)` (placeholder `Ej. Azulejos del baño de la 2ª planta`), `¿Quién lo pagó?`; buttons `Guardar gasto` / `Guardar cambios`; `Guardado en «{obra}»`; errors above. Row: title `tituloGasto`, camera icon if `recibo_path`, small line `detalleGasto` + `Pagué yo` badge, amount `fmtEUR`.

**State**: no localStorage; only `obra:refrescar` listener (above).

**Code lessons**: :41-47 expenses+invoices now one list, filter "who paid + month" requested by owner; :88-91 return the stored provider name to avoid "leroy merlin"/"Leroy Merlin"; :113 owner-paid is owner-only (also enforced by DB); :123-124 legacy-invoice files are shared with the frozen copy, never delete; :370 "Lo pagué yo" counts in owner's cash box so only owner may set it; :385 old categories remain selectable; :434-435 old photo deleted unless legacy; :508-509 "Concepto" was mandatory and confusing → now optional "Nota".

**Discrepancies**
* GAS-05 says compress "≤ 1600 px"; code caps only the **width** (`lib/image.ts:3`), a tall photo can exceed 1600 px high.
* GAS-05 "date (max today)": HTML `max` only, no JS validation (:505).
* GAS-04 second line: `detalleGasto` also omits the category when it equals the title and omits note `"Factura"` (`lib/gastos.ts:11-13`) — spec only says "note (if not the title)".
* Editing a legacy invoice whose `concepto` is `"Factura"`/equals provider: prefill is empty, so **saving writes `concepto: null`** (:374,413) — silent data change.
* Edit that moves an expense to another obra without a new file leaves the file under the **old obra's folder** (`recibo_path` unchanged); storage policy looks only at the first path segment (comment `SelectorArchivo.tsx:41-42`) → possible loss of read access. Unclear if intended (:394,411).
* GAS-06 seeded favourites (Leroy Merlin, Obramat, BigMat) are not in client code (DB seed). Spec's "Case-insensitive de-duplication" is client-side only.
* GAS-07 signed URL expiry is 600 s (spec silent). Spec says Cambiar/Borrar absent for non-owner on owner expenses; code also shows them for everyone else on "empresa" expenses (no further role check — DB decides).

---

## 2. `app/(dashboard)/facturas/page.tsx` — FacturasPage
Server redirect: `redirect("/gastos")` (legacy bookmarks). No data. Comment :3-6. (Spec route map: matches.)

---

## 3. `components/gastos/ProveedorSelector.tsx` — GAS-06
Exports `buscarProveedor(lista, nombre)` = `lista.find(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase())`; `ProveedorSelector({valor,onChange,proveedores,onFavorito})`.
* Roles/modules: none. No Supabase calls (parent does `onFavorito → asegurarProveedor(nombre, fav)` then `setProveedor(guardado)`).
* Behaviour: native `<select>` (comment :15-19: iPhone wheel with groups). Options: `— Sin proveedor —` (value ""), optgroup `★ Favoritos` (if any), optgroup `Otros` (if any), `+ Otro proveedor…` (sentinel `__nuevo__`). Choosing the sentinel switches to free-text input (`autoFocus`, placeholder `Nombre del proveedor`) + link `Lista` (back to select, clears value). Initial mode = text if the initial `valor` is non-empty and not in the list (:34).
* Star toggle (only when `valor.trim()`): label `Añadir a favoritos` / `En favoritos · quitar`; disabled while saving; toggles to `!existente?.favorito`; works on a typed name not yet in the list (creates it).

---

## 4. `components/ui/ArchivoViewer.tsx`
`ArchivoViewer({path, tipo?, bucket="facturas"})`. Effect on `[path,bucket]`: `storage.from(bucket).createSignedUrl(path, 600)` → `data?.signedUrl ?? null`. While no URL: spinner (also forever if the call fails — no error text). `tipo === "application/pdf"` → `<embed type=application/pdf class h-[420px]>`; otherwise `<img alt="Recibo">`. Min height 160 px. Users: gastos detail (bucket `facturas`), dinero cobro detail (`facturas`), resumen receipt sheet (default bucket).

## 5. `components/ui/SelectorArchivo.tsx` — GAS-05/DIN-04
Exports `BUCKET_DOCUMENTOS = "facturas"`, type `ArchivoElegido = {blob, type, name, preview?}`, `SelectorArchivo({archivo,onChange})`, `subirArchivo(supabase, obraId, carpeta, archivo): Promise<{path}|{error}>`.
* Input: hidden `<input type=file accept="image/*,application/pdf" capture="environment">` (the `capture` attr forces the camera on many phones). Input value is never reset (re-picking the same file after removing it fires no change).
* `elegir`: if `file.type === "application/pdf"`: `size > 10*1024*1024` → error `El PDF pesa demasiado (máx. 10 MB).` else `onChange({blob:file,type:"application/pdf",name})`. Anything else → `compressImageToBlob(file)` → `onChange({blob, type:"image/jpeg", name, preview: URL.createObjectURL(blob)})` (preview URL never revoked); exception → `No se pudo procesar el archivo. Inténtalo de nuevo.`
* UI strings: `Procesando…`, `Hacer foto o subir PDF`; chosen state shows icon/thumbnail + filename + X (clears).
* `subirArchivo`: ext `pdf` if type is pdf else `jpg`; path `${obraId}/${carpeta}/${crypto.randomUUID()}.${ext}`; `storage.from("facturas").upload(path, blob, {contentType: archivo.type})`; returns `{error: error.message}` or `{path}`. Comment :325-326: **path must start with obra id — storage rule checks only that first segment.** Carpetas used: `"gastos"`, `"cobros"`.
* Comment :248-249: photos compressed because phone photos weigh MBs and did not upload on site coverage.

## 6. `lib/image.ts` — `compressImageToBlob(file, maxW=1600, quality=0.75): Promise<Blob>`
FileReader → `Image` → canvas, `scale = Math.min(1, maxW/img.width)` (width only), `toBlob("image/jpeg", quality)`. Errors thrown with `tr("No se pudo procesar la imagen")` (no 2D ctx or null blob); `img.onerror`/`reader.onerror` reject with raw event.

## 7. `components/ui/PagadoPor.tsx`
* `PagadoPorSelector({valor,onChange})`: two buttons, `La empresa` (Building2, value `empresa`) and `Lo pagué yo` (Wallet, value `personal`); default is set by parent ("empresa"). Comment :349-354: default company so untouched = company payment; wording "lo pagué yo" not "mi dinero" because it may be boss's money → counts in "mi caja".
* `PagadoPorBadge({pagadoPor})`: renders nothing unless `personal`; then pill `Pagué yo` (uppercase styling).
* `totalPersonal(items)`: sum of `personal` importes with plain floats (**not cents**) — used by Resumen.
* Role checks: none (callers decide).

## 8. `components/ui/MonthFilter.tsx` — GAS-03
`MonthFilter({mes: string|null, onChange, onClear})`. No month → link `Filtrar por mes` (sets `currentMonth()`). With month → bar: prev arrow (`shiftMonth(mes,-1)`), `monthLabel(mes)`, next arrow (`shiftMonth(mes,+1)`, **not capped at current month**, future months allowed), and `Ver todas` (calls `onClear`). Comment says for "facturas, gastos...". Used only by gastos.

## 9. `components/ui/Card.tsx`, `Button.tsx`, `Field.tsx`, `Empty.tsx` (visual primitives, no data/roles)
* `Card(className, ...div props)`; `StatCard({label,value,icon?,hint?})`; `HeroStatCard({label,value,sub?,chart?,icon?})` (big number, optional 24x8 chart slot; used by Planificación).
* `PrimaryButton` (full width; `disabled` → dim style + `cursor-not-allowed`), `GhostButton`, `DangerButton`, `IconButton` (40x40, `disabled:opacity-35`). All pass through button props.
* `Field({label, children})` (uppercase small label, bottom margin), `Input`, `Select` (shared field class).
* `Empty({icon, title, sub?})` (centered icon 30 px, title, optional sub).
(Parity: these are looks, not behaviour — only the props contracts matter.)

---

## 10. `app/(dashboard)/dinero/page.tsx` — DineroPage / Dinero / Linea / FilaEntrega / DetalleCobro / CobroForm / EntregaForm
Implements DIN-01..05.

**Who sees what**
* `rol === "jefe_obra"` → `Empty(Wallet)` `Solo para el dueño y el manager` / `Aquí se ve lo que paga el cliente y lo que queda en la obra.` (:43-51). (Workers are redirected by AccesoGate.)
* `conCaja = esDueno && modulos.caja_jefe` (:59): gates the "Mi caja" card, the tabs row, the "Del jefe" tab, the `Recibido del jefe (esta obra)` line.
* `esDueno` gates **loading** of `entregas` and personal expenses (:82) — loaded even when the `caja_jefe` module is OFF; managers never request them.
* `recibidoObra = esDueno ? suma(entregas.filter(e => e.obra_id === obraActual.id)) : 0` (:106).

**Reads** (function `cargar`, on mount / obra change / `obra:refrescar` / after every write)
1. `Promise.all`: `from("cobros").select("*").eq("obra_id", obra).order("fecha",{ascending:false})`; `from("gastos").select("importe,pagado_por,obra_id").eq("obra_id", obra)`; `from("tareas").select("presupuesto").eq("obra_id", obra)`. Budget = `suma(tareas.map(x => ({importe: x.presupuesto})))`.
2. If `esDueno`: `Promise.all`: `from("entregas").select("*").order("fecha",{ascending:false})` (ALL obras, no filter); `from("gastos").select("importe,pagado_por,obra_id").eq("pagado_por","personal")` (all obras).
3. `ArchivoViewer` for cobro proof (signed 600 s).
Not rendered when `!obraActual`.

**Writes**
* Cobro insert (`CobroForm.guardar`): optional upload `subirArchivo(supabase, obraId, "cobros", archivo)` (error → `No se pudo subir el archivo ({detalle}).`); `from("cobros").insert({obra_id, importe: Number(importe), fecha, concepto: concepto.trim()||null, archivo_path, archivo_tipo: archivo?.type ?? null})`; on error remove the uploaded file and show `err.message`. On success close sheet + `cargar()`.
* Cobro delete (`borrarCobro`): **storage remove first** (`if c.archivo_path → remove([path])`), then `from("cobros").delete().eq("id", c.id)`; **no error handling for either**; then close sheet + `cargar()`. (If RLS blocks the delete the proof file is already gone.)
* Entrega insert (`EntregaForm`): `from("entregas").insert({owner_id: miembro.user_id, importe: Number(importe), fecha, concepto: concepto.trim()||null, obra_id: obraId || null})`; error shown as `err.message`.
* Entrega delete: `from("entregas").delete().eq("id", e.id)` then `cargar()`; errors ignored.
* Entrega form only mounted if `miembro` exists (:328).

**Client rules**: amount `Number(importe) > 0` (button disabled; both forms); date `max=todayStr()` HTML-only; cents via `lib/dinero.ts`; `pctPresupuesto = presupuesto > 0 ? Math.round(gastado/presupuesto*100) : 0`, bar width `min(100, pct)`, red when > 100; budget block only `presupuesto > 0`; balance sign: `balanceTotal >= 0` → "positivo" in green with explicit `+`; caja `queda >= 0` → "Me quedan para gastos", else "La empresa me debe" shown as `Math.abs`. Two-step deletes: entrega (trash icon → text button `Borrar`, aria-label `Borrar`); cobro (`Borrar este pago` → `Toca otra vez para borrarlo de verdad`). Per-obra "pagado por mí" list: iterates `obras` (context list), sums by `obra_id`, drops 0, sorts desc.
* Formula: `balanceTotal = round((cobrado − gastado + recibidoObra)*100)/100`; `recibidoObra` is added **regardless of `modulos.caja_jefe`** (only the display line is gated).

**Strings**: `Esta obra ·` + obra name; lines `Cobrado del cliente`, `Recibido del jefe (esta obra)`, `Gastado`; `La obra va en positivo` / `La obra va en negativo`; `Presupuesto del plan · {importe}`; `{pct}% gastado`; card `Mi caja ·` `todas las obras`; `Me ha dado el jefe`, `He pagado yo`, `Me quedan para gastos` / `La empresa me debe`; tabs `Del cliente`, `Del jefe`; buttons `Añadir lo que ha pagado el cliente`, `Añadir dinero que me dio el jefe`; empties `Sin cobros en esta obra` / `Apunta aquí cada pago del cliente para ver cómo va la obra.`, `Sin entregas apuntadas` / `Cada vez que el jefe te dé dinero para gastos o sueldos, apúntalo aquí.`; row defaults `Pago del cliente`, `Dinero para gastos`; section `Lo que he pagado yo, por obra` + hint `Para ver cada ticket: en «Gastos» de esa obra, toca «Pagué yo».`; sheets `Pago del cliente`, `Dinero del jefe`; forms `Importe (€)`, `Fecha`, `Concepto (opcional)` (placeholders `Ej. Primera certificación, anticipo…` / `Ej. Para gastos, sueldos de la semana…`), `Justificante (opcional)`, `Obra (opcional)` with option `— En general, no de una obra —`; submit `Guardar pago` / `Guardar`. Cobro row shows `+{fmtEUR}` green, file icon if proof; entrega row `{fecha}` + ` · {obra}` if tagged.
**State**: tab `pestana` ("cliente"|"jefe") local only; `obra:refrescar`.
**Lessons**: :29-37 two separate accounts (obra vs "mi caja"); :41-42 site lead must not see collected money (margin; DB also denies); :83-84 caja is all obras — boss gives money to the person, not to an obra; :104-105 obra-tagged boss money counts as available obra money; :576 boss money is general, obra only as memory aid.
**Discrepancies**
* DIN-02: spec "Recibido del jefe (esta obra)" shown only owner+module ON+>0 ✔, but the **balance** still adds obra-tagged entregas when the module is OFF (:106-107).
* DIN-04: client-payment list/detail not role-limited beyond route; spec "detail with proof viewer and two-step delete" ✔. Boss-money list shows entregas of **all** obras, not only current (:86).
* Delete errors are swallowed (cobro/entrega), and cobro deletes the file before the row (:112-113).
* DIN-03 "Lo que he pagado yo, por obra" appears only inside the "Del jefe" tab (not in the Mi caja card).

---

## 11. `app/(dashboard)/vehiculos/page.tsx` — VehiculosPage / DiaDelVehiculoSoloVer / DiaDelVehiculo / UsoForm
Implements VEH-01..04. Module `vehiculos` + worker access handled by the gate.

**Who sees what**
* `esTrabajador` (from `useMiembro`) → read-only sheet (`DiaDelVehiculoSoloVer`) and **no** "Añadir vehículo" (:151,175). Everyone else (owner, manager, **site lead**) gets "Añadir vehículo" and the editable sheet.

**Reads**
* Mount only (`[supabase]`): `from("vehiculos").select("*").eq("activo", true).order("nombre")`; `from("trabajadores").select("*").eq("activo", true).order("nombre")` (:42-43). No obra filter, no refresh event.
* On mount and every `fecha` change: `from("usos_vehiculo").select("*").eq("fecha", fecha).order("created_at")` (:47) — **all obras that day** (RLS), not filtered by obra.

**Writes**
* Add vehicle: `supabase.auth.getUser()`; if no user or empty name → silently return; `from("vehiculos").insert({owner_id: user.id, nombre: nuevoNombre.trim()}).select().single()`; on success append + sort `localeCompare`; **errors ignored**, form closed either way. (`owner_id` = current user's id, even for a manager — unclear how the DB maps it.)
* Save usage `guardarUso(vehiculoId, datos, usoId?)`: row `{obra_id, conductor_id|null, destino: destino.trim()||null}`; update → `from("usos_vehiculo").update(fila).eq("id", usoId)`; insert → `.insert({...fila, vehiculo_id, fecha})`. Error `code === "23505"` → `Ese coche ya está apuntado en esa obra este día.`, else `error.message`. Success → `cargarUsos()`. (DB column for the note is **`destino`**; `km_inicio/km_fin` exist in type but are unused.)
* Delete usage: `from("usos_vehiculo").delete().eq("id", usoId)`, error text shown in the sheet.

**Client rules**: counter `cochesHoy = distinct vehiculo_id in usos`; shown only if there are vehicles: `Ningún coche apuntado este día` / `trN(n,"{n} coche en uso este día","{n} coches en uso este día")`; per vehicle one line per use (`obra · conductor`, current obra bold); sheet: obras already used that day are not offered again (`libres`), the "Añadir otra obra este día" button hidden when none free; with no uses the sheet opens directly in the form ("nuevo") and has no "Volver"; editing keeps its own obra in options; default obra = `obraActual?.id` if offered else first option; driver select only if `trabajadores.length > 0`; save disabled if `!obraId`; delete = trash icon → `Quitar` (second tap), no explicit cancel; unknown obra name → `Otra obra`.
**Strings**: `Todavía no hay vehículos` / `Añade el primero para apuntar quién lo lleva y a qué obra.`; `Sin usar este día`; `Añadir vehículo`, placeholder `Ej. Furgoneta — 1234 ABC`, `Cancelar`, `Añadir`; worker sheet `Sin usar este día.`, `Lo llevó {nombre}`, `Sin más detalles`; editor `Toca para añadir conductor o notas`, `Quitar`, aria `Quitar esta obra del día`, `Añadir otra obra este día`; form `¿Quién lo llevó? (opcional)` (option `Sin especificar`), `¿A qué obra fue?`, `¿Dónde más tuvo que ir? (opcional)` (placeholder `Ej. Leroy Merlin, vertedero, almacén…`), `Guardar`, `Volver`. Date header `fmtDateLong(fecha)`. Day nav = `DayNav` component (outside scope).
**State**: `fecha` local (init `todayStr()`); no events.
**Lessons**: :20-27 no km any more, several obras per day → each obra-day is its own record, **show all obras not just the selected** (else a car used elsewhere looked unused).
**Discrepancies**
* VEH-04 / capability matrix: master list add is owner+manager; code only blocks workers, so **site leads see "Añadir vehículo"** (:151) and failure is silent (:65-72).
* VEH-01 note text "¿Dónde más tuvo que ir?" ✔; DB column is `destino`.
* Vehicle list not refreshed on `obra:refrescar`; no "deactivate vehicle" UI in this screen (only `activo=true` filter).

---

## 12. `app/(dashboard)/notas/page.tsx` + `components/ui/GrabadorAudio.tsx` — NOT-01..04
**Who sees what**: no checks in page (gate: gestores + module `notas_voz`). Returns `null` without `obraActual`.

**Reads** (`cargar`, on mount, obra change, **date change**, and after every write)
* `Promise.all`: `from("notas_audio").select("*").eq("obra_id", obra).eq("fecha", fecha).maybeSingle()`; `from("notas_audio").select("*").eq("obra_id", obra).order("fecha",{ascending:false}).limit(12)`.
* If a note exists: storage `notas` `createSignedUrl(audio_path, 3600)`.
* Sets `cargando=true`, clears URL and `confirmarBorrado` first.

**Writes** (`guardarGrabacion(blob, extension, segundos)`)
1. Upload: bucket `notas`, path `${obraActual.id}/${crypto.randomUUID()}.${extension}`, `upload(path, blob, {contentType: blob.type || undefined})` (no upsert). Error → `No se pudo guardar el audio ({detalle}).`
2. `from("notas_audio").upsert({obra_id, fecha, audio_path: path, duracion_seg: segundos}, {onConflict: "obra_id,fecha"})`. Error → remove new file, `No se pudo guardar la nota. Inténtalo de nuevo.`
3. If previous note (`nota?.audio_path` from state at call time) → `storage.from("notas").remove([anterior])` (after DB success). Then `cargar()`.
* Delete (`borrar`): `storage.remove([nota.audio_path])` first, then `from("notas_audio").delete().eq("id", nota.id)`, then `cargar()`; errors ignored. Two-step: `Eliminar nota` → `Cancelar` / `Confirmar borrado`.

**Recorder rules** (`GrabadorAudio({onGrabado(blob, ext, seconds), disabled})`)
* `FORMATOS` in order: `audio/webm`→`webm`, `audio/mp4`→`m4a`, `audio/aac`→`aac`, `audio/ogg`→`ogg`; first one `MediaRecorder.isTypeSupported`; fallback `{mime:"", ext:"webm"}`; `MediaRecorder` undefined → null → unsupported message. Blob type = `recorder.mimeType || formato.mime`. Empty blob (size 0) → `onGrabado` not called, no message. Timer counts seconds via interval; `segundosRef` is what is saved; `fmtDuracion(s)` = `m:ss`.
* Unmount while recording releases mic and interval (:273-278).
* Errors: `Este navegador no permite grabar audio. Prueba con Safari o Chrome actualizados.`; `No se pudo acceder al micrófono. Revisa los permisos del navegador.`
* Buttons: `Grabar nota de voz` (disabled while `subiendo`), recording: `Parar · {tiempo}` (red). Comment :228-233: Safari/iPhone cannot record webm → mp4; choose what the phone supports.
* Closure risk (observation): `onGrabado` is the function captured when recording started, so `fecha`/`nota` seen at save time are those of that render if the user changes day while recording (day nav stays active). Unclear if v1 guards this.

**Strings**: `Nota de este día`, duration `fmtDuracion(duracion_seg)` (only if not null), `Cargando audio…`, `Si grabas otra vez, sustituye a esta nota`, no-note text `Sin nota de voz el {fecha}. Cuenta qué se ha hecho hoy en la obra.` (fecha = `fmtDate`), `Guardando…`, `Últimas notas`, empty `Todavía no hay notas de voz` / `Las que grabes aparecerán aquí.`; tapping a latest-note row does `setFecha(n.fecha)`, active row highlighted.
**State**: `fecha` local; no events/refresh hook.
**Discrepancies**: none against NOT-01..04 (paths, 1 h URL, 12 latest, replace-and-delete match). Extras: no `useEnRefresco`; `nota` replacement relies on state `nota` (stale possible); audio is the only record data (no size/duration limit).

---

## 13. `app/(dashboard)/planificacion/page.tsx` + `components/planificacion/*` + `lib/gantt.ts` — PLA-01..06

### 13.1 PlanificacionPage
**Who sees what**: no role/module check in page (gate: gestores). Returns `null` without obra.
**Reads**: on mount/obra change only (no refresh event): `from("tareas").select("*").eq("obra_id", obra).order("orden").order("fecha_inicio")`; `setError(err ? err.message : "")` (load errors are shown — comment :43-44).
**Writes**
* Add: `orden = tareas.length === 0 ? 0 : Math.max(...orden) + 1`; `from("tareas").insert({obra_id, ...d, orden})` (d = `{nombre, fecha_inicio, fecha_fin, avance, presupuesto}`); error → `setError(msg)`, sheet stays; success → close + `cargar()`.
* Edit: `from("tareas").update(d).eq("id", editando.id)`. Delete: `from("tareas").delete().eq("id", editando.id)`.
* Import (`importar(r, reemplazar)`): if replace → `from("tareas").delete().eq("obra_id", obra)` (error returned as string); `desde = reemplazar || tareas.length===0 ? 0 : max(orden)+1`; **one bulk insert** `r.secciones.map((s,i) => ({obra_id, nombre: s.nombre, fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, avance: 0, orden: desde+i, presupuesto: s.presupuesto}))`; error returned to the import sheet; success → close sheet, `cargar()`. **Not atomic**: delete-then-insert can leave an empty plan if the insert fails.
**Derived**: `avance = avanceObra(tareas)`, `rango = rangoObra`, `hechas = avance >= 100 count`, `retrasadas = estadoTarea==="retrasada" count`, `presupuestado = Σ Number(presupuesto||0)` (floats), `hoy = todayStr()`.
**Strings**: hero `Avance de la obra`, value `{avance}%`, sub `Todavía no hay plan` or `{hechas} de {total} tareas terminadas` + ` · {n} con retraso` (only if > 0); buttons `Añadir tarea`, `Desde Excel`; error banner `No se ha podido guardar:` + message (also used for **load** errors); empty `Sin planificación todavía` / `Añade las tareas de la obra con sus fechas y verás aquí el diagrama y el avance.`; card `Del {desde} al {hasta}` (dates bold), `trN(dias,"{n} día","{n} días")`, `Presupuestado` + `fmtEUR` (only if > 0); sheets `Nueva tarea`, `Traer el plan del Excel`, `Tarea`.
**Discrepancies**: PLA-06 errors are shown in a page-level banner **behind** the open sheet (sheet stays open) — visibility from the sheet is unclear (:151-155); banner prefix says "No se ha podido guardar" even for load errors. Import is non-atomic. PLA-05 picker accepts `.xlsx,.xlsm` (see 13.3).

### 13.2 TareaForm (`components/planificacion/TareaForm.tsx`) — PLA-04
Props `{tarea?, onGuardar(datos): Promise<void>, onBorrar?}`; `DatosTarea = {nombre, fecha_inicio, fecha_fin, avance, presupuesto: number|null}`. Defaults: start/end `todayStr()`, avance 0. `valido = nombre.trim().length>0 && fin >= inicio`. Save sends `nombre.trim()`, avance, `presupuesto = trim()==="" ? null : Number(presupuesto)`. Live line: `trN(duracionDias(...),"Dura {n} día.","Dura {n} días.")` or red `La fecha de fin no puede ser anterior a la de inicio.` Progress: `<input type=range min=0 max=100 step=5>` + quick buttons 0/25/50/75/100 (`{v}%`). Labels: `Tarea` (placeholder `Ej. Cimentación, Estructura, Tabiquería…`), `Empieza`, `Termina`, `Avance — {pct}%`, `Presupuesto (€, opcional)` (placeholder `Lo que hay previsto para esta parte`). Button `Añadir tarea` / `Guardar cambios`. Delete (only when `onBorrar`): `Borrar tarea` → `Tocar otra vez para borrarla de verdad`. No error display of its own (page banner). Quick buttons lack `type="button"` (harmless, no `<form>`).

### 13.3 ImportarExcel (`components/planificacion/ImportarExcel.tsx`) — PLA-05
Props `{hayTareas: number, onImportar(r, reemplazar): Promise<string|null>}`.
* Lazy import of `@/lib/importar-excel` inside `leer` (comment :192-194: ~1 MB library).
* Picker: `accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`. Read error → `e.message` or `No he podido leer el archivo.`
* Step 1 texts: `Leyendo el archivo…` / `Elegir el Excel del Gantt`; help `Vale el Gantt tal cual lo tienes: con la fila de semanas arriba (` + `WEEK 1 16.03-20.03` + `…) y las casillas pintadas de color. Cada capítulo se convierte en una tarea, con sus fechas y lo que tiene presupuestado.`; link `<a href="/plantilla-plan-obra.xlsx" download>` `¿No tienes el plan en Excel? Descarga la plantilla`.
* Step 2 (preview): `Hoja {hoja}` · `trN(semanas,"{n} semana","{n} semanas")` · `trN(secciones.length,"{n} capítulo","{n} capítulos")`; year selector `Año del plan` with `−` / `+` (re-reads the file with `anio ± 1`, disabled while reading) + hint `El Excel no guarda el año. He puesto el que hace que la primera semana empiece en lunes — compruébalo en las fechas de abajo.`; each section: name, `{fmtDate(ini)} – {fmtDate(fin)} · trN(lineas,"{n} línea","{n} líneas")`, `fmtEUR(presupuesto)`; `Presupuesto total`; warnings (red box, one div per `avisos`); if `hayTareas > 0`: checkbox-button `trN(hayTareas,"Borrar la {n} tarea que ya hay y dejar solo estas.","Borrar las {n} tareas que ya hay y dejar solo estas.")` + `Si lo dejas sin marcar, estas se añaden a las de ahora.`; submit `Reemplazar por este {n} capítulo`/`Reemplazar por estos {n} capítulos` (when checked) else `Añadir este {n} capítulo`/`Añadir estos {n} capítulos`; `Elegir otro archivo` resets. Save error (from page) shown in the sheet; the sheet closes itself on success (page closes it).

### 13.4 Gantt (`components/planificacion/Gantt.tsx`) — PLA-03
`Gantt({tareas, hoy, onTocar})`; returns null if no range. Month scale (`mesesDelRango`), "Hoy" marker (`tr("Hoy")`, line spanning rows, **only if today inside the range** (`posicionDia` null otherwise)), one row per task: name, `{avance}%` coloured, bar positioned in % (`left`, `width`, `minWidth: 6px`) with progress fill `width: avance%`, state label `Terminada` / `En marcha` / `Retrasada` / `Pendiente` (coloured green/yellow/red/grey), `{fmtDate(ini)} – {fmtDate(fin)} · trN(duracionDias,"{n} día","{n} días")`. Whole row is a button → `onTocar(t)`. Comments: :17-27 full class names (Tailwind purge), outline on 0 % bars; :58-63 whole plan squeezed to screen width, no horizontal scroll (iPhone problems).
### 13.5 MiniGantt (`components/planificacion/MiniGantt.tsx`)
Used on Home (not here): bars only, 5 px tall, same colours per `estadoTarea`, `minWidth 5px`; returns null without range. No text.

### 13.6 `lib/gantt.ts` (pure)
`diasEntre(a,b)` = `round((localDate(b)-localDate(a))/86400000)` (rounding for DST); `duracionDias(t)` = `diasEntre(ini,fin)+1`; `rangoObra(tareas)` → `{desde: min fecha_inicio, hasta: max fecha_fin, dias}` or null; `posicionBarra(t, rango)` → `{izquierda: diasEntre(desde, ini)/dias*100, ancho: duracion/dias*100}`; `posicionDia(fecha, rango)` → % or null if outside; `avanceObraExacto(tareas)` = Σ(d·avance/100)/Σd ×100 (weighted by duration; 0 if no days); `avanceObra` = `Math.round(exacto)`; `estadoTarea(t, hoy)`: `avance >= 100` → hecha; `fecha_fin < hoy` → retrasada; `fecha_inicio <= hoy` → en_marcha; else pendiente; `mesesDelRango(rango)` → `[{etiqueta, ancho%}]` with month label `toLocaleDateString("es-ES",{month:"short"}).replace(".","")` (**hard-coded es-ES**, ignores UI language) first/last month clipped to range.
Lesson: date strings compared with `<`/`>` (alphabetical = chronological); never `toISOString()` (:1-12).

---

## 14. `lib/importar-excel.ts` — exported API (PLA-05)
* Types: `SeccionImportada {nombre, fecha_inicio, fecha_fin, presupuesto, lineas}`; `ResultadoImport {secciones, hoja, semanas, anio, totalPresupuesto, avisos[]}`.
* `leerArchivoExcel(file, anioForzado?)`: `XLSX.read(await file.arrayBuffer(), {cellStyles:true, sheetStubs:true})` (comment: styles needed or no dates) → `leerPlanExcel(wb, anioForzado?)`.
* `adivinarAnio(semanas, hoy=new Date())` (exported): real-date weeks → that year; text weeks → first of `[y, y+1, y-1, y+2, y-2]` where week-1 start is a Monday; else current year.
* Behaviour (sheet scanning): all sheets, header row = first row within 30 rows having ≥ 2 week-like cells; week cell = text matching `d[.,/-]m - d[.,/-]m` (`RE_SEMANA`; tolerates "12-06" typo) or an Excel date cell (date number format, not time). Week end for real dates = day before next week else +4 days. Years: text weeks: month decreasing → year +1; week crossing year end handled. Painted cell = fill colour present, `patternType !== "none"`, not white. Chapters (col A): `^(РОЗДІЛ|РАЗДЕЛ|CHAPTER|SECTION|PHASE|CAPÍTULO|SECCIÓN|FASE|PARTIDA|ZONA|BLOQUE)` + boundary, or a bare number `\d{1,3}\.?` with col B name (`"{n}. {name}"`); rows starting `TOTAL` ignored; jobs: col A code `\d+([.,]\d+)+\.?` with col B name; scan starts at sheet top (first chapter may sit above header row). Amount column: header (header row) matching `AMOUNT|TOTAL|IMPORTE|PRESUPUESTO|СУМА|ВАРТІСТЬ`, else the 5th column (index 4); amount in same row or, if 0 and next row col A is not a job code, the next row; numbers only. Grouping: with any chapter → by chapter (`Sin capítulo` for orphans) else each job = a task. Section: start = min painted start, end = max painted end, `presupuesto` = Σ rounded to cents, `lineas` count; sections without painted weeks are dropped with warning.
* Errors/warnings (exact): `No he encontrado la fila de semanas. Se esperan columnas tipo «WEEK 1 16.03-20.03».`; `«{nombre}» no tiene ninguna semana pintada, se ha dejado fuera.`; `He leído la hoja pero no he encontrado capítulos con semanas pintadas. Revisa que el Gantt tenga las celdas coloreadas.`
* Lessons: header comment :13-28 (client "Gant Banus.xlsx", plan point 20); :205-207 start above header row or first chapter is lost; :287 `cellStyles` mandatory.
* Discrepancy vs PLA-05: extra amount headers (PRESUPUESTO, СУМА, ВАРТІСТЬ, 5th-column fallback), extra chapter words (SECTION, PHASE, SECCIÓN, BLOQUE, РАЗДЕЛ, РОЗДІЛ), `.xlsm` accepted, `TOTAL…` rows skipped, jobs with no painted weeks are kept inside a group (only fully unpainted groups warned).

## 15. `lib/exportar-excel.ts` — `exportarResumenObra(args)` (RES-02)
Args `{nombreObra, mesLabel, fichajes, trabajadores, gastos, usosVehiculo, vehiculos, jornadaHoras, historial}`; static `import * as XLSX from "xlsx"` (so `/resumen` ships the library eagerly). Sheets (headers are **hard-coded Spanish, not `tr()`**):
* `Horas`: only fichajes with `hora_entrada`; columns `Trabajador, Fecha, Entrada, Salida, Horas, Horas extra, Corregido por el dueño (Sí/No), Confirmado (Sí/No, blank if not corrected), Fuera de la obra (`Sí (N m)` using `distancia_metros ?? "?"` when `ubicacion_ok === false`)`; sorted by date then worker name. Worker unknown → `—`.
* `Gastos` (always): `Fecha, Proveedor, Categoría, Importe (€) (Number), Pagado por (`El dueño`/`La empresa`), Nota (concepto), Tiene foto (Sí/No)`; sorted by date.
* `Vehículos` (if any): `Fecha, Vehículo, Conductor, Destino` (no obra column).
* `Correcciones` (if any history): `Fecha, Trabajador, Entrada antes, Entrada después, Salida antes, Salida después, Cambiado el (toLocaleString("es-ES"))`.
* File name: `` `${nombreObra} - ${mesLabel}.xlsx`.replace(/[\\/:*?"<>|]/g,"") ``; `XLSX.writeFile`.
Uses `minutosTrabajados`, `minutosExtra`, `fmtHoras` from `lib/horas`.

## 16. `lib/gastos.ts`, `lib/dinero.ts` (pure)
* `tituloGasto(g)` = `proveedor?.trim() || concepto?.trim() || categoria`. `detalleGasto(g)`: parts = [`concepto` if non-empty and `!== titulo` and `!== "Factura"`], [`categoria` if `!== titulo`], `fmtDate(fecha)`; joined with ` · `.
* `suma(items)`: Σ `Math.round(Number(importe||0)*100)` / 100. `pagadoPorMi(gastos)` = `suma(personal only)`. `balanceObra(cobros, gastos)` → `{cobrado, gastado, balance: round((cobrado−gastado)*100)/100}`. `miCaja(entregas, gastos)` → `{recibido, pagado, queda: round((recibido−pagado)*100)/100}`. Comment: floats gave 0.30000000000000004 and 1-cent errors at month end.

---

## 17. `app/(dashboard)/resumen/page.tsx` — ResumenPage + ResumenTrabajadores / DetalleTrabajadorMes / ResumenVehiculos / DetalleVehiculoMes / ResumenGastos / DetalleGastosCategoria
Implements RES-01..05. No role/module checks (gate: gestores). Returns `null` without obra.

**Reads**
| When | Call |
|---|---|
| mount | `from("trabajadores").select("*").order("nombre")` (NOT filtered by `activo` or obra); `from("vehiculos").select("*").order("nombre")` (**not** filtered by `activo`) |
| mount, obra change, month change | four queries, each `.eq("obra_id", obra).gte("fecha", desde).lt("fecha", hasta)`: `fichajes` `select("*")`; `usos_vehiculo` `select("*")`; `gastos` `select("*")`; `fichajes_historial` `select("*")` (no order) |
| open worker sheet (on `trabajadorId`/month change) | `from("fichajes").select("*").eq("trabajador_id", id).gte("fecha",desde).lt("fecha",hasta).order("fecha")` — **all obras** |
| open vehicle sheet | `from("usos_vehiculo").select("*").eq("vehiculo_id", id).gte("fecha",desde).lt("fecha",hasta).order("fecha")` — all obras |
| open receipt | storage `facturas` signed URL 600 s (ArchivoViewer default bucket) |
No writes, no refresh event.

**Client rules**: `month` init `currentMonth()`; prev arrow always; next arrow `disabled={month >= currentMonth()}`; `Mes actual` link only if month ≠ current; section chips (`flex-wrap`, comment :144-146 iPhone bounce fix blocks horizontal gestures): `Trabajadores`, `Vehículos`, `Gastos` (rendered `tr(label)`), default `trabajadores`; Excel button calls `exportarResumenObra` with state already loaded (sync; `exportando` toggled in try/finally, effectively never visible).
* Workers: rows = every worker, `regs = fichajes of month with hora_entrada`; `totalesFichajes(regs, jornadaHoras)` → `{trabajados, extra, sinCerrar}`; sorted by days desc; if all zero days → empty. Row: name, `trN(dias,"{n} día","{n} días")`, pill `+{horas} extra` (`fmtHoras(extra)`), `{n} sin salida` (red), right: `fmtHoras(trabajados)` or `—` + `trabajadas`.
* Worker sheet: summary `{n} día(s)` · `todas las obras` + total; `Horas extra` line if > 0; `trN(sinCerrar,"{n} día sin hora de salida (no cuenta en el total)","{n} días sin hora de salida (no cuenta en el total)")`; per row: `weekdayShort(fecha)`, obra name (`Otra obra` fallback), `{entrada||"—:—"}–{salida||"—:—"}` + ` · {ubicacion}`, hours, `+{extra}`.
* Vehicles: per vehicle days = distinct `fecha` among this obra's uses; sorted desc; sub `Toca para ver qué días y a qué obras` / `No se usó en esta obra este mes`; right number + `trN(dias,"día","días")`. Sheet: `trN(dias,"{n} día de uso","{n} días de uso")` · `todas las obras`; per row weekday, obra, `conductor · destino` or `Sin más datos`.
* Expenses: month total `Total del mes` (plain float sum), `Pagado por ti` line if `totalPersonal > 0`; one card per category **in `CATEGORIAS_GASTO` only** with n>0, sorted by total desc: icon map (Material=Package, Maquinaria / alquiler=Wrench, Combustible=Fuel, Mano de obra externa=Users, Sueldos=Banknote, Gestión de residuos=Trash2, Otros=MoreHorizontal; fallback MoreHorizontal), `tr(cat)`, total, `fmtDate(desde)` or `desde – hasta`, `trN(n,"{n} gasto","{n} gastos")`, `pct = round(catTotal/total*100)`, bar `width pct%`. Tap → sheet titled by the category name (raw, not `tr`) with `Total: {importe}` (bold) · count, rows sorted by date desc: title (`tituloGasto`), camera icon if file, `fmtDate`, `Pagué yo` badge, amount; rows without file are disabled; row with file → sheet `Recibo` with `title · fecha · importe` + ArchivoViewer.
* Other empties: `Todavía no hay trabajadores`; `Sin fichajes este mes` / `Aquí verás cuántos días trabajó cada uno.`; sheet `Sin fichajes este mes`; `Todavía no hay vehículos`; `No se usó este mes`; `Sin gastos este mes`; `Cargando…`.
**State**: none persisted.
**Lessons**: :256-260 worker sheet shows all obras (to pay/control); :343-345 no more km; :37 invoices no longer a tab.
**Discrepancies**
* RES-05 / GAS: categories not in `CATEGORIAS_GASTO` (legacy) are **missing from the cards but included in "Total del mes"**, so percentages sum < 100 and the cards do not add up to the total (:437-449).
* DIN-05 "all sums in cents": Resumen (and `totalPersonal`) sum with floats (:436,442,503).
* RES-04: vehicles list includes **inactive** vehicles (no `activo` filter, :80); workers not filtered by `activo`.
* RES-02: sheet `Vehículos` has no Obra column; headers not translated; library not lazy-loaded.
* RES-01 ✔ (next disabled on current month). Spec says sheets "Gastos"/"Correcciones" ✔.
* RES-03 spec "zone note": `ubicacion` field shown after the times ✔.

---

## Data-access methods needed
(Interface list for the data layer. All filters exact; `sb` = Supabase client; companies scoped by RLS, no explicit company filter.)

**Obra data**
* `gastosDeObra(obraId)` → `from('gastos').select('*').eq('obra_id',obraId).order('fecha',{ascending:false}).order('created_at',{ascending:false})`
* `gastosDeObraEnMes(obraId, mes)` → `from('gastos').select('*').eq('obra_id',obraId).gte('fecha',desde).lt('fecha',hasta)` (desde/hasta = `monthBounds(mes)`; no order) [Resumen]
* `gastosResumenDeObra(obraId)` → `from('gastos').select('importe,pagado_por,obra_id').eq('obra_id',obraId)` [Dinero]
* `gastosPagadosPorMi()` → `from('gastos').select('importe,pagado_por,obra_id').eq('pagado_por','personal')` [owner, all obras]
* `crearGasto(datos)` → `from('gastos').insert({obra_id,concepto,proveedor,importe,categoria,fecha,recibo_path,recibo_tipo,pagado_por}).select().single()`
* `actualizarGasto(id, datos)` → `from('gastos').update(datos).eq('id',id).select().single()`
* `borrarGasto(id)` → `from('gastos').delete().eq('id',id)`
* `proveedores()` → `from('proveedores').select('*').order('nombre')`
* `crearProveedor(nombre, favorito)` → `from('proveedores').insert({nombre,favorito})`
* `marcarProveedorFavorito(id, favorito)` → `from('proveedores').update({favorito}).eq('id',id)`
* `cobrosDeObra(obraId)` → `from('cobros').select('*').eq('obra_id',obraId).order('fecha',{ascending:false})`
* `crearCobro({obra_id,importe,fecha,concepto,archivo_path,archivo_tipo})` → `from('cobros').insert(...)`
* `borrarCobro(id)` → `from('cobros').delete().eq('id',id)`
* `entregas()` → `from('entregas').select('*').order('fecha',{ascending:false})` [owner only; all obras]
* `crearEntrega({owner_id,importe,fecha,concepto,obra_id|null})` → `from('entregas').insert(...)`
* `borrarEntrega(id)` → `from('entregas').delete().eq('id',id)`
* `presupuestosTareas(obraId)` → `from('tareas').select('presupuesto').eq('obra_id',obraId)`
* `tareasDeObra(obraId)` → `from('tareas').select('*').eq('obra_id',obraId).order('orden').order('fecha_inicio')`
* `crearTarea({obra_id,nombre,fecha_inicio,fecha_fin,avance,presupuesto,orden})` → `from('tareas').insert(...)`
* `actualizarTarea(id, {nombre,fecha_inicio,fecha_fin,avance,presupuesto})` → `from('tareas').update(...).eq('id',id)`
* `borrarTarea(id)` → `from('tareas').delete().eq('id',id)`
* `borrarTareasDeObra(obraId)` → `from('tareas').delete().eq('obra_id',obraId)`
* `crearTareas(filas[])` → `from('tareas').insert([{obra_id,nombre,fecha_inicio,fecha_fin,avance:0,orden,presupuesto}, ...])` (bulk; ideally one transaction with the preceding delete)

**Vehicles**
* `vehiculosActivos()` → `from('vehiculos').select('*').eq('activo',true).order('nombre')`
* `vehiculosTodos()` → `from('vehiculos').select('*').order('nombre')` [Resumen]
* `crearVehiculo(ownerUserId, nombre)` → `from('vehiculos').insert({owner_id,nombre}).select().single()`
* `trabajadoresActivos()` → `from('trabajadores').select('*').eq('activo',true).order('nombre')`
* `trabajadoresTodos()` → `from('trabajadores').select('*').order('nombre')` [Resumen]
* `usosVehiculoDelDia(fecha)` → `from('usos_vehiculo').select('*').eq('fecha',fecha).order('created_at')` (all obras)
* `usosVehiculoDeObraEnMes(obraId, mes)` → `from('usos_vehiculo').select('*').eq('obra_id',obraId).gte('fecha',desde).lt('fecha',hasta)`
* `usosDeVehiculoEnMes(vehiculoId, mes)` → `from('usos_vehiculo').select('*').eq('vehiculo_id',vehiculoId).gte('fecha',desde).lt('fecha',hasta).order('fecha')`
* `crearUsoVehiculo({vehiculo_id,fecha,obra_id,conductor_id|null,destino|null})` → `from('usos_vehiculo').insert(...)` (unique violation code `23505` must map to "Ese coche ya está apuntado en esa obra este día.")
* `actualizarUsoVehiculo(id,{obra_id,conductor_id,destino})` → `from('usos_vehiculo').update(...).eq('id',id)`
* `borrarUsoVehiculo(id)` → `from('usos_vehiculo').delete().eq('id',id)`
* `usuarioActual()` → `sb.auth.getUser()` (id used as `owner_id` for vehicles)

**Notes**
* `notaDelDia(obraId, fecha)` → `from('notas_audio').select('*').eq('obra_id',obraId).eq('fecha',fecha).maybeSingle()`
* `ultimasNotas(obraId, n=12)` → `from('notas_audio').select('*').eq('obra_id',obraId).order('fecha',{ascending:false}).limit(12)`
* `guardarNota({obra_id,fecha,audio_path,duracion_seg})` → `from('notas_audio').upsert({...},{onConflict:'obra_id,fecha'})`
* `borrarNota(id)` → `from('notas_audio').delete().eq('id',id)`

**Summary (month, all by month bounds)**
* `fichajesDeObraEnMes(obraId, mes)` → `from('fichajes').select('*').eq('obra_id',obraId).gte('fecha',desde).lt('fecha',hasta)`
* `fichajesDeTrabajadorEnMes(trabajadorId, mes)` → `from('fichajes').select('*').eq('trabajador_id',trabajadorId).gte('fecha',desde).lt('fecha',hasta).order('fecha')`
* `historialDeObraEnMes(obraId, mes)` → `from('fichajes_historial').select('*').eq('obra_id',obraId).gte('fecha',desde).lt('fecha',hasta)`

**Storage**
* `subirArchivo(bucket='facturas', obraId, carpeta:'gastos'|'cobros', blob, contentType)` → `storage.from('facturas').upload(`${obraId}/${carpeta}/${uuid}.${pdf|jpg}`, blob, {contentType})` → `{path}|{error}` (no upsert)
* `subirAudio(obraId, blob, extension)` → `storage.from('notas').upload(`${obraId}/${uuid}.${ext}`, blob, {contentType: blob.type || undefined})`
* `urlFirmada(bucket, path, segundos)` → `storage.from(bucket).createSignedUrl(path, secs)`; used with `facturas`/600 and `notas`/3600
* `borrarArchivo(bucket, path)` → `storage.from(bucket).remove([path])` (skip when the expense has `factura_origen_id`)

**Pure helpers to keep (not data access but used with it)**: `monthBounds(mes)`, `suma`, `pagadoPorMi`, `balanceObra`, `miCaja`, `tituloGasto`, `detalleGasto`, `avanceObra/avanceObraExacto`, `rangoObra`, `estadoTarea`, `posicionBarra`, `posicionDia`, `mesesDelRango`, `leerArchivoExcel` (lazy), `exportarResumenObra`, `compressImageToBlob(file,1600,0.75)`.
