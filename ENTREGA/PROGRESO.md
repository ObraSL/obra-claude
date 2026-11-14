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

## Cerrado el 2026-11-14 (la dueña paró aquí: el diseño ya se puede juzgar)
- **Ajustes** terminado (las dos variantes, tema nuevo incluido) y `/ajustes` enlazado: ya no hay enlace muerto.
- **i18n 537/537** en uk y en: no queda español suelto en las pantallas ucranianas.
- `npm run build` ✔ (16 rutas) · `npm run lint` ✔ **0 errores** (v1 tiene 4) · 5 tests + i18n ✔ · 40 pruebas del motor ✔.
- Entregables escritos: `README.md`, `COMO-PROBARLO.md`, `INFORME-FINAL-UA.md`, `dependencias.md`,
  `dorados-checksums.md` (7 dorados tocados, todos justificados), `cambios-en-dorados.md`.

## Falta (nada de esto obliga a rehacer lo hecho)
1. **4 pantallas poco frecuentes**: `/alta`, `/alta/ok`, `/reset-password`, `/admin`.
   Patrón a copiar: `app/login/page.tsx` + `components/pantallas/login/VistaLogin.tsx`.
   Las rutas de API que necesitan (`app/api/alta/*`) ya están portadas y funcionando.
2. **Galería `/galeria`** completa (idioma, actor, módulos, estado, marcos 320/375/430/768/1280)
   sobre el motor en memoria. Hoy solo existe `/galeria/identidad`.
3. **Scripts QA** con Playwright (desbordamiento, objetivos ≥ 44 px, errores de consola, capturas).
   Comprobado a mano en el navegador en todas las pantallas; con script, no.
4. **MATRIZ-PARIDAD.md** con evidencia fila a fila + pasada adversaria (Fase 4).
5. Iconos PWA y manifest con la marca nueva (`scripts/generar-iconos.mjs`), `metricas.md`,
   `capturas/`, `01-diseno/RESUMEN-UA.md`.
6. Con base de datos de pruebas: SQL de seguridad (`supabase/prueba-*.sql`) y `scripts/seed-dev.*`.

## Bloqueos
- Límite de uso de los ayudantes Sonnet (se reinicia cada 5 h). Base de datos de pruebas pendiente de la dueña.
