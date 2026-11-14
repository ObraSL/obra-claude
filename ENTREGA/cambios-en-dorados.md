# Cambios en módulos dorados

Todos los módulos dorados (MASTER-PROMPT §5) se copiaron **byte a byte** desde `_ref-v1/`
(commit `4ed79ad`). Esta es la lista completa de diferencias, con su motivo.

| Archivo | Cambio | Motivo | Base |
|---|---|---|---|
| `scripts/test-importar-excel.ts` | total esperado `84743` → `85706` | número desfasado tras la mejora intencionada del commit `e9c7d33` | §5(d), verificado: pasa |
| `eslint.config.mjs` | ignora `scripts/**` | `claves-i18n.js` usa `require`, prohibido por las reglas de lint | §5(d) |
| `eslint.config.mjs` | ignora `_ref-v1/**` y `_pack/**` | copia de v1 y paquete del encargo viven dentro del espacio de trabajo | §5(e), DECISIONES D-04 |
| `tsconfig.json` | `exclude` añade `_ref-v1`, `_pack` | igual: sin esto `next build` compilaría la copia de v1 | §5(e), DECISIONES D-04 |
| `proxy.ts` | antes de `updateSession`, devuelve `NextResponse.next()` si `NEXT_PUBLIC_DATOS === "memoria"` (modo demo) o si `NEXT_PUBLIC_GALERIA === "1"` y la ruta es `/galeria…` | la galería (sin login, §6) y el modo demo funcionan sin Supabase; sin esto el proxy llama a Supabase sin URL y falla, o manda la galería a `/login`. En producción ninguna variable existe: comportamiento idéntico a v1 | §5(e), DECISIONES D-09 |
