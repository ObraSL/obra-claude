# SHA-256 de los módulos dorados: v1 (4ed79ad) vs v2

Generado el 2026-11-14. Las filas marcadas **≠** son las ediciones registradas en `cambios-en-dorados.md`;
el resto son copias byte a byte.

| Archivo | v1 | v2 | |
|---|---|---|---|
| `lib/horas.ts` | `ec760fb6de3fbf7d…` | `ec760fb6de3fbf7d…` | = |
| `lib/dinero.ts` | `8735669383129b8c…` | `8735669383129b8c…` | = |
| `lib/gantt.ts` | `e4e15a8a08d8caff…` | `e4e15a8a08d8caff…` | = |
| `lib/importar-excel.ts` | `72035ca7434fdec9…` | `72035ca7434fdec9…` | = |
| `lib/format.ts` | `84fda356e54032c7…` | `84fda356e54032c7…` | = |
| `lib/gastos.ts` | `0b937d16e34120a3…` | `0b937d16e34120a3…` | = |
| `lib/geo.ts` | `0650885472595751…` | `0650885472595751…` | = |
| `lib/image.ts` | `4741be32c641a66a…` | `4741be32c641a66a…` | = |
| `lib/modulos.ts` | `584ae20c1eab6adc…` | `584ae20c1eab6adc…` | = |
| `lib/offline-fichajes.ts` | `8b4d34f5916ef3d2…` | `9453c8022ba55f0e…` | **≠** |
| `lib/exportar-excel.ts` | `28d7cacea0e0d39a…` | `28d7cacea0e0d39a…` | = |
| `lib/eliminar-obra.ts` | `d6749b2d896ba35f…` | `d6749b2d896ba35f…` | = |
| `lib/errores.ts` | `0094799bd376a5a6…` | `0094799bd376a5a6…` | = |
| `lib/pagos.ts` | `dd817411da13f8fd…` | `dd817411da13f8fd…` | = |
| `lib/types.ts` | `70678d02fbd8ca34…` | `70678d02fbd8ca34…` | = |
| `lib/i18n/index.ts` | `c575931ffbe43d3a…` | `c575931ffbe43d3a…` | = |
| `lib/i18n/provider.tsx` | `74a8db7155efaf8f…` | `74a8db7155efaf8f…` | = |
| `lib/i18n/uk.ts` | `487786ecd6ad3817…` | `5edf28a1a7955bdf…` | **≠** |
| `lib/i18n/en.ts` | `5aa7457cf21ca7a7…` | `f9899f2cb94dbb1c…` | **≠** |
| `lib/supabase/client.ts` | `ca6b53abbd6234c9…` | `ca6b53abbd6234c9…` | = |
| `lib/supabase/middleware.ts` | `0b9e7a1835881e40…` | `0b9e7a1835881e40…` | = |
| `lib/supabase/server.ts` | `f8bec5af1761715c…` | `f8bec5af1761715c…` | = |
| `proxy.ts` | `4a8893c74c1f39f7…` | `355d150058d07f2c…` | **≠** |
| `instrumentation.ts` | `454b6f4e130c8959…` | `454b6f4e130c8959…` | = |
| `instrumentation-client.ts` | `53656f3e1661ebb3…` | `53656f3e1661ebb3…` | = |
| `public/sw.js` | `eab2bdd1ea723d5d…` | `eab2bdd1ea723d5d…` | = |
| `vercel.json` | `7b143251b81d8285…` | `7b143251b81d8285…` | = |
| `eslint.config.mjs` | `9d60ba29efeda1e8…` | `eb658b9cd6c3c173…` | **≠** |
| `tsconfig.json` | `bd8fc4b9e68c8eec…` | `10fa3a16022e67e0…` | **≠** |
| `next.config.ts` | `a972c4f0ffa6dd71…` | `a972c4f0ffa6dd71…` | = |
| `postcss.config.mjs` | `7b299d3d3b16699d…` | `7b299d3d3b16699d…` | = |
| `package.json` | `968393e0c4d8ef3d…` | `968393e0c4d8ef3d…` | = |
| `supabase/migracion-admin-plataforma.sql` | `39953e7d9a4872a0…` | `39953e7d9a4872a0…` | = |
| `supabase/migracion-cerrar-ajustes-lectura.sql` | `a3964a621f68ca7b…` | `a3964a621f68ca7b…` | = |
| `supabase/migracion-cerrar-borrado-trabajador.sql` | `97b85b0b07e0d736…` | `97b85b0b07e0d736…` | = |
| `supabase/migracion-codigos-alta.sql` | `dc13a2bd3f09c91f…` | `dc13a2bd3f09c91f…` | = |
| `supabase/migracion-corregir-chequeo-dueno.sql` | `7d0bb5caaec7eaaf…` | `7d0bb5caaec7eaaf…` | = |
| `supabase/migracion-dinero.sql` | `a724d2c1f684e5a6…` | `a724d2c1f684e5a6…` | = |
| `supabase/migracion-eliminar-obra.sql` | `6fe086cbb76eef08…` | `6fe086cbb76eef08…` | = |
| `supabase/migracion-empresas.sql` | `0dac6ecdae5d158a…` | `0dac6ecdae5d158a…` | = |
| `supabase/migracion-errores.sql` | `42690220210af6e3…` | `42690220210af6e3…` | = |
| `supabase/migracion-fix-historial-trigger.sql` | `7a6d46d3622479a1…` | `7a6d46d3622479a1…` | = |
| `supabase/migracion-funciones-empresa.sql` | `f1d33418d83a6199…` | `f1d33418d83a6199…` | = |
| `supabase/migracion-gastos-vehiculos.sql` | `00eb5a3547116cce…` | `00eb5a3547116cce…` | = |
| `supabase/migracion-geolocalizacion.sql` | `3d74ee632db51227…` | `3d74ee632db51227…` | = |
| `supabase/migracion-historial-fichajes.sql` | `cdc572f1c07b8c1d…` | `cdc572f1c07b8c1d…` | = |
| `supabase/migracion-horas-dueno.sql` | `9dc37342c03c509b…` | `9dc37342c03c509b…` | = |
| `supabase/migracion-invitar-empresa.sql` | `2fdd6fe66d327b44…` | `2fdd6fe66d327b44…` | = |
| `supabase/migracion-modulos.sql` | `7db7aa8478d7dff8…` | `7db7aa8478d7dff8…` | = |
| `supabase/migracion-mover-obra-fichaje.sql` | `34f9ae3d0c4f5609…` | `34f9ae3d0c4f5609…` | = |
| `supabase/migracion-pagos-stripe.sql` | `d8dd6947a71d259d…` | `d8dd6947a71d259d…` | = |
| `supabase/migracion-planificacion.sql` | `b82818b5c76d0a84…` | `b82818b5c76d0a84…` | = |
| `supabase/migracion-proteger-borrado.sql` | `3bb0b43e7865f2f5…` | `3bb0b43e7865f2f5…` | = |
| `supabase/migracion-proteger-cuenta-dueno.sql` | `2efd09637ca75812…` | `2efd09637ca75812…` | = |
| `supabase/migracion-soporte.sql` | `c14ba4646abda69e…` | `c14ba4646abda69e…` | = |
| `supabase/migracion-vision-roles.sql` | `9c2b44ca05f0e6c5…` | `9c2b44ca05f0e6c5…` | = |
| `supabase/prueba-aislamiento.sql` | `5db33fae0aac0773…` | `5db33fae0aac0773…` | = |
| `supabase/prueba-choque.sql` | `4c58db2e74b9950f…` | `4c58db2e74b9950f…` | = |
| `supabase/prueba-gastos-vehiculos.sql` | `d84e1b87b85bfc2f…` | `d84e1b87b85bfc2f…` | = |
| `supabase/prueba-horas-dueno.sql` | `922759c0a64b47d4…` | `922759c0a64b47d4…` | = |
| `supabase/schema.sql` | `58c20f832d13c40f…` | `58c20f832d13c40f…` | = |
| `scripts/claves-i18n.js` | `ecb9dca743e49bd7…` | `ecb9dca743e49bd7…` | = |
| `scripts/generar-iconos.mjs` | `f6ed0f55a9708aef…` | `f6ed0f55a9708aef…` | = |
| `scripts/generar-plantilla-plan.py` | `aa906efa7f90ca6a…` | `aa906efa7f90ca6a…` | = |
| `scripts/test-dinero.ts` | `a6e014a1085e95a7…` | `a6e014a1085e95a7…` | = |
| `scripts/test-fechas.ts` | `c0ba77334ddf0749…` | `c0ba77334ddf0749…` | = |
| `scripts/test-gantt.ts` | `34adfb04f38bc802…` | `34adfb04f38bc802…` | = |
| `scripts/test-horas.ts` | `89b200578c2ed7a5…` | `89b200578c2ed7a5…` | = |
| `scripts/test-importar-excel.ts` | `6cf68cc504542aef…` | `3da7c8e781c591a3…` | **≠** |
| `scripts/test-memoria.ts` *(nuevo en v2)* | — | `40bb5fbee712d4ff…` | **≠** |

**7 módulos dorados distintos** (más `scripts/test-memoria.ts`, que es nuevo de v2 y no existe en v1) de 70; todos con su motivo en `cambios-en-dorados.md`.
