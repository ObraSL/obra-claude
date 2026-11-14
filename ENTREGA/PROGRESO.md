# PROGRESO — Control de Obra v2 · Agente A

> Una sesión nueva empieza leyendo ESTE archivo. Luego `_pack/MASTER-PROMPT.md`,
> `_pack/ESPECIFICACION-ESTRUCTURA.md`, `_pack/TRAMPAS-Y-LIMITES-TECNICOS.md`, `ENTREGA/DECISIONES.md`.

## Datos fijos
- Agente: **A**. Espacio de trabajo: `C:\Projects\apps\claude` (D-01).
- **Nunca** abrir `C:\Projects\apps\antigravity` (el otro agente) ni tocar `D:\obra` (solo lectura) ni producción.
- Referencia v1 congelada: `_ref-v1/` (commit `4ed79ad`, no se versiona).
- Referencia visual: Dribbble «Construction Management App UI», copiar lo más fiel posible (D-02).
- Base de datos: **no hay** → motor en memoria + modo demo (D-03, D-08, D-09).
- Tests: `node _pack/herramientas/correr-tests.mjs`. Motor en memoria: `node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts`.
- Servidor de desarrollo: `.claude/launch.json` en `C:\Projects` → `obra-v2-dev` (puerto 3100). `.env.local` = `NEXT_PUBLIC_DATOS=memoria`, `NEXT_PUBLIC_GALERIA=1`.

## Notas técnicas de Next 16.3.4 (resumen de node_modules/next/dist/docs)
- `error.tsx` recibe `{ error, retry }` (estable en 16.3). `global-error.tsx` pinta su propio `<html><body>`.
- `params`/`searchParams` son Promesas; `PageProps<'/x'>`, `LayoutProps<'/x'>` globales.
- `proxy.ts` (exporta `proxy`), solo runtime Node. `useSearchParams` necesita `<Suspense>`.
- `next/font/google` variable: sin `weight`. `export const dynamic = "force-dynamic"` sigue valiendo (no usamos cacheComponents).
- `next build` ya NO imprime «First Load JS»: medir de otra forma (`.next` + analizador o tamaño de chunks).
- Un módulo con `"use client"` no puede exportar funciones que llame el servidor (por eso `lib/tema.ts` + `lib/tema-provider.tsx`).

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| 0 Estudio | ✅ | `00-inventario.md` (122 operaciones de datos, 78 discrepancias DIS-xx) + anexos `_inventario/A–D`. MATRIZ-PARIDAD esqueleto (121 IDs + 6 Q + 5 FIX + 45 T). |
| 1 Diseño | 🟡 | `01-diseno/concepto.md`, `identidad.md` (tokens con contraste medido). Tokens en `app/globals.css` (dos temas). Piezas firma: `components/marca/Edificio.tsx`, `Varillas.tsx`, `Logo.tsx`. Vista viva: `/galeria/identidad`. |
| 2 Port del sistema | 🟡 | Dorados copiados; 5/5 tests TS verdes. `lib/datos/db.ts` (tipo Db + helper `r`). **En curso (ayudantes Sonnet):** `lib/datos/memoria/` (motor en memoria + semilla + test) y `lib/datos/consultas/` (consultas exactas de v1). |
| 3 Integración | 🟡 | Primitivas UI listas: `components/ui/` (Boton, BotonIcono, Cargando, Panel, Etiqueta, Hoja, Campo/Entrada/Selector/AreaTexto/EntradaHora, Aviso, Vacio, NavDia/NavMes/FiltroMes, Interruptor/Segmentos/BorrarDosPasos, SelectorIdioma). Shell: `components/shell/` (BarraInferior, BarraLateral, BarraSuperior, SelectorObra/FormObraNueva, Refresco + useEnRefresco). `lib/nav.ts` portado. |
| 4 Verificación | ⏳ | |
| 5 Entrega | ⏳ | |

## Siguiente paso exacto
1. Cuando terminen los ayudantes: revisar `lib/datos/memoria` (correr su test) y `lib/datos/consultas` (tsc).
2. `lib/datos/provider.tsx` (DatosProvider/useDb; memoria con import dinámico) + `lib/datos/demo.ts` (cliente demo persistido en localStorage).
3. Contextos `lib/miembro-context.tsx`, `lib/obra-context.tsx`, `lib/use-session.ts` sobre `useDb()`; puertas (AuthGate, AccesoGate, Pendiente, Suscripción, AvisoControl); `app/(dashboard)/layout.tsx` + Shell.
4. Pantallas: Fichajes (trabajador + cuadrilla + corrección) → Inicio (gestor + trabajador) → Login/landing → resto.
5. Textos nuevos usados hasta ahora (añadir a uk.ts/en.ts): «Cargando…», «Borrar {campo}», «Mes anterior», «Mes siguiente», «Navegación principal», «Activa», «Cerrada», «Obra actual», «Sí, borrar».

## Bloqueos
- Ninguno. Base de datos de pruebas pendiente de la dueña (no bloquea).
