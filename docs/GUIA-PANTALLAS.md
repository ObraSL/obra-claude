# Guía para construir una pantalla de Control de Obra v2

Léela entera antes de escribir. Las pantallas de ejemplo ya hechas —cópiales la forma— son:
`components/pantallas/fichajes/` (`MisHoras.tsx` contenedor · `VistaMisHoras.tsx` vista ·
`Cuadrilla.tsx` · `VistaCuadrilla.tsx` · `HojaCorregirHoras.tsx` · `Sello.tsx`) y `app/login/page.tsx`
+ `components/pantallas/login/VistaLogin.tsx`.

## 0. Reglas que no se discuten
- **El comportamiento es el de v1, exacto.** La referencia está en `_ref-v1/` (solo lectura). Lee el
  archivo de v1 de tu pantalla ENTERO y su anexo en `ENTREGA/_inventario/`. Mismas consultas, mismos
  pasos, mismas confirmaciones, mismos permisos por rol. No inventes funciones, campos ni textos.
- **Lo que cambia es el aspecto** y la organización del código. Nada del aspecto de v1 se copia
  (ni clases `obra-*`, ni colores crema/naranja, ni Barlow/Inter/JetBrains).
- **Los textos en español son claves de i18n**: cópialos de v1 **carácter a carácter** dentro de
  `tr("…")` / `trN(n, "uno", "varios")` / `trJsx("… {x} …", { x: <b/> })`. Nunca los reescribas (se
  perdería su traducción). Si de verdad hace falta un texto nuevo (p. ej. un `aria-label`), apúntalo
  en tu informe final con su traducción propuesta a ucraniano e inglés; **no edites** `lib/i18n/uk.ts`
  ni `en.ts` (los edita una sola persona al final). No guardes textos traducidos en constantes de
  módulo (el idioma cambia en caliente): llama a `tr()` al pintar.
- **Nunca abras** `C:\Projects\apps\antigravity` ni nada en `D:\`. No instales dependencias. No hagas
  commits. No toques archivos fuera de los que se te asignan.
- Código y comentarios en **español**. Conserva en comentarios las lecciones que v1 dejó en los suyos.

## 1. Arquitectura: contenedor + vista
- **Contenedor** (`components/pantallas/<area>/<Nombre>.tsx`, `"use client"`): lee `useDb()`,
  `useObra()`, `useMiembro()`, llama a las funciones de `@/lib/datos/consultas` (nunca a
  `db.from(...)` directamente; si falta una consulta, añádela en el archivo de su dominio en
  `lib/datos/consultas/` copiando la de v1 exacta), decide permisos, gestiona errores y pasa props.
- **Vista** (`Vista<Nombre>.tsx`): solo props; sin `useDb`, sin contextos de datos. Tiene que poder
  pintarse en la galería con datos de mentira. El estado local de un formulario sí puede vivir en la vista.
- La página (`app/(dashboard)/<ruta>/page.tsx`) solo monta el contenedor.
- Todas las consultas devuelven `{ data, error }` (nunca lanzan). **Cada llamada trata su error**:
  lectura → `Aviso tono="error"` con el mensaje (y los datos anteriores si los había); escritura → el
  mensaje del servidor tal cual (`error.message`), nunca en silencio. Usa `esFalloDeRed(error)` de
  `@/lib/offline-fichajes` para distinguir «sin conexión».
- **Estados obligatorios** en cada pantalla: cargando (`CargandoBloque alto="bloque"` la primera vez),
  vacío (`Vacio` con el texto de v1), con datos, error, y los de cada rol/módulo que la ven distinto.
- Recarga: `useEnRefresco(cargar)` de `@/components/shell/Refresco` (gesto de tirar hacia abajo) y
  recargar al cambiar de obra/día/mes.
- Fechas: **nunca `toISOString()` para una fecha de calendario** (T-01). Usa `todayStr`, `shiftDay`,
  `shiftMonth`, `monthBounds`, `currentMonth`, `fmtDate`, `fmtDateLong`, `monthLabel` de `@/lib/format`.
  Dinero: sumas con `suma`, `pagadoPorMi`, `balanceObra`, `miCaja` de `@/lib/dinero` (céntimos, T-31);
  formato con `fmtEUR`/`fmtEURCorto`. Horas: `@/lib/horas`. Gantt: `@/lib/gantt`.
- Permisos: `useMiembro()` da `rol`, `esDueno`, `esTrabajador`, `gestiona` (dueño+manager+jefe de obra),
  `administra` (dueño+manager), `modulos`, `userId`. La base de datos es la autoridad; la interfaz solo
  esconde lo que sería rechazado. Nunca «arregles» una pantalla pidiendo permisos más amplios.
- Borrados y acciones destructivas: **siempre en dos pasos**, como en v1 (`BorrarDosPasos`).

## 2. Diseño: el sistema «Salvia»
Tokens en `app/globals.css` (dos temas; **usa solo clases de token**, nunca colores a mano):

| Clase | Uso |
|---|---|
| `bg-fondo` / `text-tinta` | lienzo de la pantalla y su texto |
| `bg-sup` + `text-tinta` (`text-tinta-2` secundario) | tarjetas, hojas (`<Panel>`) |
| `bg-sup-honda` + `text-sobre-honda` (`text-sobre-honda-2`) | **datos**: importes, totales, gráficos, listas con dinero (`<Panel tono="honda">`) |
| `bg-lima text-sobre-lima` | la acción principal y lo «hecho / en positivo» |
| `bg-coral text-sobre-coral` | alerta, error, retraso, negativo (siempre como RELLENO con texto oscuro) |
| `bg-negro text-sobre-negro` | acción secundaria, elemento activo de un selector |
| `bg-fondo/60` | bloque interior dentro de un `Panel` de tono `sup` |
| `bg-white/10` | bloque interior dentro de un panel hondo |

Reglas de contraste (medidas, ver `ENTREGA/01-diseno/identidad.md`):
- Texto pequeño secundario (`text-tinta-2`) **solo sobre `bg-sup`**, nunca directamente sobre el lienzo.
- El coral **nunca como color de texto** sobre salvia; es relleno. La lima como texto solo dentro de
  un panel hondo (`text-lima-texto`).
- Importes y horas: clase `cifras` (tabulares) siempre; los importantes dentro de un panel hondo.
  Signo explícito en balances (`+`/`−`) y siempre una palabra o icono junto al color (nunca solo color).
- Nada de grises claros para texto que importe. Nada de sombras ni bordes de 1 px para separar: se
  separa con el paso de tono (lienzo → sup → honda).

Tipografía (una familia, Geist): `text-gigante` (56, cifra firma) · `text-cifra` (40) · `text-h1` (26,
**un solo `<h1>` por pantalla**) · `text-titulo` (20, títulos de bloque/hoja) · `text-base` (16) ·
`text-peq` (14) · `text-micro` (12, solo datos auxiliares). Pesos: `font-light` para cifras grandes,
`font-medium` títulos y botones, `font-semibold` nombres. Tracking `tracking-[-0.02em]`…`[-0.04em]` en
tallas grandes.

Forma: radios `rounded-boton` (6) · `rounded-[10px]` (bloques interiores) · `rounded-panel` (14) ·
`rounded-hoja` (22). Espaciado en rejilla (`grid gap-4` entre bloques de una pantalla).

### Piezas disponibles (úsalas; no crees duplicados)
- `@/components/ui/Boton`: `Boton` (variante `principal|secundario|suave|peligro|fantasma`, `grande`,
  `ancho`, `cargando`, `icono`) y `BotonIcono` (44×44; `sobre="lienzo|panel|honda"`).
- `@/components/ui/Panel`: `Panel` (`tono="sup|honda"`, `relleno`, `como`) y `CabeceraBloque`.
- `@/components/ui/Etiqueta`: `Etiqueta` (`tono="honda|lima|coral|negro|suave"`, `icono`).
- `@/components/ui/Hoja`: `Hoja` (`titulo`, `subtitulo`, `onCerrar`, `pie`) — **todos los formularios
  van en una Hoja con el botón principal en `pie`** (queda sobre el teclado del móvil, T-08).
- `@/components/ui/Campo`: `Campo` (etiqueta/pista/error), `Entrada`, `Selector`, `AreaTexto`,
  `EntradaHora` (con su × de borrar, T-09).
- `@/components/ui/Aviso`: `Aviso` (`tono="error|sin-conexion|info|ok"`).
- `@/components/ui/Vacio`, `@/components/ui/Cargando` (`Cargando`, `CargandoBloque`).
- `@/components/ui/Navegacion`: `NavDia`, `NavMes`, `FiltroMes`.
- `@/components/ui/Controles`: `Interruptor`, `Segmentos` (pestañas que se parten en líneas),
  `BorrarDosPasos`.
- `@/components/marca/Varillas`: `Varillas` — el gráfico de la casa (barras verticales finas; cada
  varilla es un dato real; va dentro de un panel hondo; lleva `resumen` accesible).
- `@/components/marca/Edificio`: el edificio isométrico que crece con el avance (0–100).
- `@/components/marca/FotoObra`: la foto de portada (decorativa, se funde con el lienzo; el tamaño y el sangrado
  se dan por `className`, p. ej. `-mx-4 h-72`). Es lo que usan las pantallas en lugar de `Edificio` (D-11).
- `@/components/pantallas/fichajes/VistaMisHoras`: `HojaTexto` (hoja con un solo campo).
- Iconos: `lucide-react`, trazo, 16–22 px, siempre `aria-hidden` si llevan texto al lado.

### Reglas de teléfono (se comprueban con un script)
- **Nada puede desbordar de lado** a 320 px: todo hijo de flex lleva `min-w-0`; los textos largos
  `break-words`; las filas de pestañas/chips `flex-wrap`; tablas → tarjetas; nunca `overflow-x-auto`,
  nunca `whitespace-nowrap` en textos traducibles (solo en cifras/horas).
- **Todo lo tocable mide ≥ 44×44 px** (`min-h-11` / `min-h-12`; acciones de obra `grande`).
- Los textos cambian de largo por idioma (ucraniano hasta ×1,9): nada de anchos fijos para etiquetas;
  nunca `truncate` en un texto crítico (botón, importe, confirmación destructiva).
- `100dvh` (nunca `100vh`), zonas seguras ya resueltas en el armazón.
- Accesibilidad: `label` real en cada campo, `aria-label` (con `tr`) en botones de solo icono,
  `aria-live`/`role="alert"` ya van en `Aviso`, foco visible (ya global), listas con `<ul>/<li>`,
  `data-testid` en los elementos clave para las pruebas.
- Movimiento: solo `transform`/`opacity`; clases `anim-subir`, `anim-sello`; nada pesado.

## 3. Qué entregar al terminar
1. Los archivos (contenedor, vista, página), compilando: `npx tsc --noEmit -p tsconfig.json` sin
   errores y `npx eslint <tus archivos>` sin errores.
2. Informe corto: archivos creados; consultas nuevas añadidas (si alguna); **textos nuevos** que no
   existían en v1 (con propuesta uk/en); cada defecto de v1 (DIS-xx de `ENTREGA/00-inventario.md` §6)
   que hayas corregido y cómo; cualquier cosa de v1 que no hayas podido reproducir exactamente.
