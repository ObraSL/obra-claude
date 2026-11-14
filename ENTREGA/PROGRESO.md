# PROGRESO — Control de Obra v2 · Agente A

> Una sesión nueva empieza leyendo ESTE archivo. Luego `docs/GUIA-PANTALLAS.md` (reglas para pantallas),
> `ENTREGA/DECISIONES.md` y, si hace falta, `_pack/MASTER-PROMPT.md` + `ESPECIFICACION-ESTRUCTURA.md`.

## Datos fijos
- Agente **A**. Espacio: `C:\Projects\apps\claude` (D-01). **Nunca** abrir `C:\Projects\apps\antigravity` ni tocar `D:\obra`.
- Sin base de datos: motor en memoria + modo demo (`.env.local`: `NEXT_PUBLIC_DATOS=memoria`, `NEXT_PUBLIC_GALERIA=1`).
- Servidor: `C:\Projects\.claude\launch.json` → `obra-v2-dev` (puerto 3100). Cuentas demo en /login (contraseña `demo-obra-2026`).
  En la consola del navegador (solo demo): `await __obraDemo.entrar("marta.salvia@reformas-salvia.invalid")`.
- Tests: `node _pack/herramientas/correr-tests.mjs` (5 TS + i18n) · `node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts` (40 ✓).

## Hecho (2026-11-14)
- Fase 0 completa: `00-inventario.md` (122 operaciones, 78 DIS), MATRIZ-PARIDAD esqueleto.
- Diseño: tokens dos temas, Geist, Edificio, Varillas, CifraAvance, primitivas UI, armazón (barras, selector de obra, refresco).
- Datos: `lib/datos/memoria` (motor + semilla), `lib/datos/consultas` (112), contextos, puertas ACC-08.
- Pantallas terminadas y vistas en el navegador (375 px, uk): landing, login, Mis horas, cuadrilla + corregir horas,
  Inicio gestor/trabajador, Planificación (Gantt + Excel), Gastos, Vehículos, Notas, Dinero, Resumen.
- API `/api/alta/*`, `/api/stripe/webhook` (copiadas de v1), `error.tsx`, `global-error.tsx`.

## Falta (por orden)
1. **Ajustes**: piezas hechas en `components/pantallas/ajustes/` (Accesos, SoporteAcceso, SeccionObras,
   SeccionListaActivable, HojaConfigurarObra, HojaEliminarObra, SelectorTema). Falta: `Ajustes.tsx` (contenedor:
   gestor/trabajador, orden AJU-01, jornada 1–24, jefe ve todas, módulos, obras, trabajadores, vehículos, tema,
   cerrar sesión), `app/(dashboard)/ajustes/page.tsx`. Ver v1 `_ref-v1/app/(dashboard)/ajustes/page.tsx`.
2. **/alta, /alta/ok, /reset-password, /admin** (no empezadas; brief completo en el historial: mismo patrón que /login).
3. **i18n**: `node scripts/claves-i18n.js` → añadir a `lib/i18n/uk.ts` y `en.ts` todos los textos nuevos.
4. `npm run build` + `npm run lint` en verde; iconos PWA y manifest con la marca nueva (`scripts/generar-iconos.mjs`).
5. **Galería `/galeria`** (idioma, actor, módulos, estado, marcos 320/375/430/768/1280) sobre el motor en memoria.
6. **Scripts QA** (desbordamiento, objetivos ≥ 44 px, errores de consola, capturas) — Playwright no instalado.
7. Fase 4: MATRIZ-PARIDAD con evidencia, pasada adversaria. Fase 5: README, COMO-PROBARLO, INFORME-FINAL-UA,
   métricas, dependencias, checksums de dorados, capturas, `01-diseno/RESUMEN-UA.md`.

## Bloqueos
- Límite de uso de los ayudantes Sonnet (se reinicia cada 5 h). Base de datos de pruebas pendiente de la dueña.
