# DECISIONES — Agente A

| # | Fecha | Decisión | Por qué / quién |
|---|---|---|---|
| D-01 | 2026-11-14 | Espacio de trabajo `C:\Projects\apps\claude` en lugar de `D:\obra-v2-A`. | Elegido por la dueña (carpeta ya creada por ella). Todo lo demás de §4 se aplica igual. |
| D-02 | 2026-11-14 | La referencia visual es el shot de Dribbble «Construction Management App UI»; la dueña pidió **copiarlo lo más fiel posible**, dejando de lado la regla C-3 para esa referencia. | Decisión explícita de la dueña tras avisarle del conflicto con C-3. Límites que se mantienen: no se usan imágenes ni archivos del autor (las ilustraciones son propias, SVG); contraste AA/AAA y demás reglas de §7 siguen vigentes; nada de la identidad de v1. |
| D-03 | 2026-11-14 | Sin base de datos al empezar: se trabaja con fixtures; la verificación con base de datos queda pendiente hasta que la dueña cree un proyecto Supabase de pruebas. | No hay Docker ni Supabase CLI en el equipo. Elegido por la dueña. |
| D-04 | 2026-11-14 | `tsconfig.json` excluye `_ref-v1` y `_pack`; `eslint.config.mjs` los ignora (además de `scripts/**`, edición permitida §5(d)). | El encargo pone `_ref-v1/` dentro del espacio de trabajo: sin excluirlo, `next build` y `eslint` compilarían la copia de v1. Inevitable (§5(e)). |
| D-05 | 2026-11-14 | `git config core.autocrlf false` en este repositorio. | Para que los módulos dorados se guarden byte a byte y sus SHA-256 coincidan con v1. |
