# Control de Obra v2

Fichajes, vehículos, gastos, dinero y planificación de obras, para una empresa de construcción.
El 80 % del uso es **en el móvil, a pie de obra**: sol, polvo, guantes, una mano, 4G malo.

Rediseño completo de v1 (commit de referencia `4ed79ad`): identidad e interfaz nuevas, **misma
estructura y mismas reglas de negocio**, misma base de datos.

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3100
```

`.env.local` (copia `.env.example`) decide de dónde salen los datos:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_DATOS=memoria` | **Modo demo**: la app entera funciona sin base de datos, con dos empresas inventadas. Es lo que trae el proyecto por defecto |
| `NEXT_PUBLIC_GALERIA=1` | Abre `/galeria/identidad` (hoja de identidad viva). Fuera de desarrollo, `/galeria` devuelve 404 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase real (proyecto de **pruebas**, nunca producción) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo en el servidor: rutas de pago. Nunca con prefijo `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Alta de empresa con tarjeta (**solo modo test**). Sin ellas, `/alta` dice que todavía no está abierta |

Para probar como se verá de verdad, **compila**, no uses el modo desarrollo (su recarga automática
borra lo que el usuario está escribiendo en el móvil):

```bash
npm run build && npm start
```

Cuentas de prueba, qué mirar y cómo: **`ENTREGA/COMO-PROBARLO.md`**.

## Comprobaciones

```bash
node _pack/herramientas/correr-tests.mjs                                  # 5 tests + traducciones
node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts  # 40 reglas de la base
npm run build                                                             # compila y revisa tipos
npm run lint                                                              # 0 errores
```

Los tests de TypeScript se lanzan **siempre con el runner**: usan el alias `@/`, que el TypeScript
nativo de Node no resuelve por su cuenta (`_pack/herramientas/alias-loader.mjs` lo arregla).

## Cómo está organizado

```
app/                      rutas (App Router). (dashboard) = la app con sesión
  (dashboard)/…           una carpeta por pantalla; la página solo monta su contenedor
  api/                    alta con tarjeta y webhook de Stripe (copiados de v1)
  galeria/identidad/      hoja de identidad viva (solo con NEXT_PUBLIC_GALERIA=1)
components/
  ui/                     primitivas: Boton, Panel, Hoja, Campo, Aviso, Etiqueta, Vacio…
  marca/                  las piezas firma: Edificio, Varillas, CifraAvance, Logo
  shell/                  armazón: barras, selector de obra, tirar para recargar
  puertas/                pantallas-puerta y la cadena de permisos (ACC-08)
  pantallas/<area>/       por pantalla: Contenedor.tsx (datos) + VistaX.tsx (solo props)
  planificacion/          Gantt y MiniGantt
lib/
  datos/consultas/        TODAS las consultas, una sola vez, idénticas a las de v1
  datos/memoria/          motor en memoria: imita Supabase con sus reglas (RLS, triggers, RPC)
  i18n/                   tr() / trN() / trJsx(); la clave es el texto en español
  horas, dinero, gantt…   módulos "dorados": copiados byte a byte de v1, no se tocan
supabase/schema.sql       el esquema, tal cual de v1
ENTREGA/                  inventario, decisiones, informes, paridad
docs/GUIA-PANTALLAS.md    cómo construir una pantalla nueva en este proyecto
```

**Contenedor y vista separados**: el contenedor lee datos y decide permisos; la vista solo recibe
props y por eso se puede pintar con datos falsos. **Todas las consultas** pasan por
`lib/datos/consultas`, nunca `db.from(...)` suelto en una pantalla.

## Reglas que no se discuten

- **La base de datos manda.** Los permisos viven en RLS y en triggers; la interfaz solo esconde lo
  que de todos modos sería rechazado. Nunca se afloja una política para que una pantalla funcione.
- **Los textos en español son las claves de i18n.** Nunca se reescribe uno: se perdería su
  traducción. Los nuevos se añaden al final de `lib/i18n/uk.ts` y `en.ts`.
- **Nada se mueve de lado.** Todo cabe a 320 px; las pestañas se parten en líneas, el Gantt se
  dibuja en porcentajes del ancho. Todo lo tocable mide 44 px o más.
- **Las fechas de calendario nunca salen de `toISOString()`** (en España devuelve el día anterior):
  se usan los ayudantes de `lib/format.ts`. El dinero se suma en céntimos (`lib/dinero.ts`).
- **La hora de un fichaje la pone el servidor**, no el móvil; se enseña la que devuelve.

Detalle de cada trampa aprendida: `_pack/TRAMPAS-Y-LIMITES-TECNICOS.md`.
La especificación congelada de qué hace el producto: `_pack/ESPECIFICACION-ESTRUCTURA.md`.
