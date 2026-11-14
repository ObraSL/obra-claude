# Base en memoria (`lib/datos/memoria/`)

Cliente que imita a `SupabaseClient` y corre las consultas de la app sobre tablas en memoria, con las reglas de `D-base-de-datos.md`.
Sirve para el modo demo, la galería de diseño y los tests de punta a punta.

## Uso

```ts
import { crearAlmacen, crearClienteMemoria, CLAVE_DEMO, CUENTAS_DEMO,
         serializarAlmacen, deserializarAlmacen } from "@/lib/datos/memoria";

const almacen = crearAlmacen("poblado");          // "poblado" | "vacio" | "textos-largos"
const db = crearClienteMemoria({
  almacen,
  red: () => "normal",       // "normal" | "cargando" | "error" | "sin-conexion" (se lee en cada llamada)
  latenciaMs: 150,           // opcional
  reloj: () => new Date(),   // opcional, inyectable en tests
  alCambiar: () => localStorage.setItem("demo", serializarAlmacen(almacen)),
});
await db.auth.signInWithPassword({ email: CUENTAS_DEMO[0].email, password: CLAVE_DEMO });
```

- Contraseña de todas las cuentas sembradas: `demo-obra-2026` (`CLAVE_DEMO`). Lista en `CUENTAS_DEMO` (rol, etiqueta, email, empresa).
- Código de empresa A: `5A1F0A01`; alta libre: `H7KQ-2MXD-9PWT` (`CODIGOS_DEMO`).
- Cuentas nuevas por `signUp` nacen SIN confirmar; en demo/tests llamar a `confirmarEmail(almacen, email)`.
- Cada cliente tiene su propia sesión (arranca con la guardada en `almacen.sesion`; entrar/salir la actualiza ahí para poder persistirla). Para probar como "anónimo" con un almacén que tiene sesión, hacer `signOut()` primero.
- Test: `node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts`.

## Ficheros

| fichero | contenido |
|---|---|
| `almacen.ts` | tablas, esquema (columnas, tipos, defectos), `crearAlmacen`, (de)serialización, utilidades de fecha |
| `semilla.ts` | datos sintéticos, `CUENTAS_DEMO`, `CODIGOS_DEMO` |
| `reglas.ts` | identidad (`mi_rol`…), RLS, triggers, CHECK/UNIQUE/FK, DML atómico |
| `consulta.ts` | constructor encadenable (`select/insert/update/upsert/delete/eq/...`) |
| `rpc.ts` | todas las RPC de D §5 |
| `storage.ts` | buckets `facturas` y `notas` |
| `auth.ts` | cuentas, sesión, trigger `crear_miembro` |
| `index.ts` | `crearClienteMemoria` y re-exportaciones |

## Qué se emula

- RLS por tabla y operación (D §3), incluida la lectura mínima de miembros inactivos/caducados/pendientes, soporte con permiso vigente y `jefe_ve_todas`.
- Triggers de `fichajes` en orden (`proteger_horas`, `correccion`, `validar_hora`, historial AFTER) con los textos exactos; hora del servidor en Europe/Madrid con reloj inyectable.
- `proteger_pagado_por_mi` en gastos; CHECK (23514), NOT NULL (23502), UNIQUE (23505, con el nombre de la restricción), FK (23503, RESTRICT y SET NULL), RLS (42501).
- Defectos de columna (`id`, `created_at`, `empresa_id` del que llama, radio 150, etc.); columnas desconocidas (PGRST204 / 42703); `numeric(12,2)` redondea a 2 decimales.
- Operaciones atómicas: si una fila falla, el statement entero se revierte (también las RPC).
- `upsert` con `ON CONFLICT`: BEFORE INSERT primero y BEFORE UPDATE después (como Postgres), solo se actualizan las columnas enviadas.
- `single()`/`maybeSingle()` (PGRST116), `count: "exact"` con/sin `head`, orden múltiple, `limit`/`range`.
- Todas las RPC de la app y las de administración; `registrar_pago_alta` / `actualizar_pago_suscripcion` / `generar_codigo_alta_libre` solo por `llamarRpcServicio` (desde el cliente dan 42501).
- Storage: política por obra (primer segmento), bucket privado, trabajadores denegados; la URL firmada es una `data:` URL cargable.
- Modos de red y latencia; `alCambiar` tras cada escritura correcta (no tras lecturas).

## Diferencias conocidas respecto a la base real

1. **Orden con NULL**: se sigue Postgres (ASC: nulos al final; DESC: nulos al principio; `nullsFirst` lo cambia). El encargo decía "nulos al final" a secas; si la app necesita nulos siempre al final en DESC, pasarlo explícito (`nullsFirst: false`).
2. **Errores de `signUp`**: se devuelve el texto del trigger (`codigo_empresa_invalido`, …) como pide el encargo; Supabase real devuelve "Database error saving new user".
3. Inserciones masivas con claves distintas por fila: la real rellena con NULL (sin defectos) las claves ausentes; aquí se aplican los defectos.
4. `single()` sobre un `update/delete` con 0 o varias filas no revierte el cambio (PostgREST sí).
5. `.select()` tras `update` con RETURNING exige política SELECT sobre la fila nueva (42501), pero no se comprueba para filas leídas en el WHERE de `update/delete` más allá de la política SELECT normal.
6. Sin relaciones embebidas (`select("a, b(c)")` da PGRST200), sin `or()`, `like`, `ilike`, `contains`, realtime ni `functions`.
7. `getSession` no falla en los modos de red (en supabase-js lee del almacenamiento local); el resto de llamadas sí obedecen al modo `cargando`/`error`/`sin-conexion`.
8. Los tokens son de pega; no hay refresco, ni OAuth, ni recuperación de contraseña real (`resetPasswordForEmail` siempre OK).
9. Las notas de voz sembradas son un WAV silencioso de 1 s aunque `duracion_seg` diga 27-52; los recibos son SVG de "ticket de ejemplo".
10. Se emula el desbordamiento de `numeric(12,2)`, pero no longitudes de `text` ni la precisión exacta de `numeric` en `avance_obra` (se devuelve un `number` de JS).
11. Fallo heredado de v1 reproducido a propósito: el límite de turno que cruza medianoche (00:15 − 30 min = 23:45) bloquea toda entrada.
12. El administrador sembrado tiene una fila `miembros` pendiente en la empresa caducada C (D §8.5: `crear_miembro` siempre crea una).
13. Si hubiera dos filas de `ajustes` para una empresa, las comprobaciones de jefe de obra fallan con 21000, como en SQL.
