# PROGRESO — Control de Obra v2 · Agente A

> Una sesión nueva empieza leyendo ESTE archivo. Luego `_pack/MASTER-PROMPT.md`,
> `_pack/ESPECIFICACION-ESTRUCTURA.md`, `_pack/TRAMPAS-Y-LIMITES-TECNICOS.md`.

## Datos fijos
- Agente: **A**. Espacio de trabajo: `C:\Projects\apps\claude` (decisión de la dueña, ver DECISIONES D-01).
- **Nunca** abrir `C:\Projects\apps\antigravity` (el otro agente) ni tocar `D:\obra` (solo lectura) ni producción.
- Referencia v1 congelada: `_ref-v1/` (commit `4ed79ad`, no se versiona).
- Referencia visual: captura de Dribbble «Construction Management App UI» (la dueña pidió copiarla lo más fiel posible, D-02).
- Base de datos: **no hay** (sin Docker ni Supabase CLI). Se trabaja con fixtures (D-03).
- Tests: `node _pack/herramientas/correr-tests.mjs` (nunca `node scripts/test-*.ts` directamente).

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| 0 Estudio | 🟡 en curso | Esqueleto de MATRIZ-PARIDAD generado (121 IDs + 6 Q + 5 FIX + 45 T). Inventario por áreas en `ENTREGA/_inventario/` (4 ayudantes). Falta unirlo en `00-inventario.md`. |
| 1 Diseño | ⏳ | |
| 2 Port del sistema | 🟡 base | Módulos dorados copiados byte a byte; `npm ci`; 5/5 tests TS en verde vía runner. `claves-i18n` falla solo porque aún no existen `app/` ni `components/`. |
| 3 Integración | ⏳ | |
| 4 Verificación | ⏳ | |
| 5 Entrega | ⏳ | |

## Siguiente paso exacto
1. Esperar/leer los 4 inventarios de `ENTREGA/_inventario/` y unirlos en `ENTREGA/00-inventario.md` (con discrepancias).
2. Diseñar la capa de datos (`lib/datos/`: interfaz + Supabase + memoria) a partir de las listas «Data-access methods needed».
3. Fase 1: concepto + tokens + primitivas.

## Bloqueos
- Ninguno. Base de datos de pruebas pendiente de la dueña (no bloquea).
