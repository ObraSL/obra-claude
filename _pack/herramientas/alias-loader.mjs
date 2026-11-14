// Cargador para ejecutar los tests de scripts/ con el TypeScript nativo de Node 24.
//
// PROBLEMA (en v1 desde el commit de los tres idiomas, 2026-09-30): lib/format.ts y
// lib/importar-excel.ts importan con el alias "@/lib/i18n", y lib/i18n/index.ts importa
// "./uk" y "./en" sin extensión. Next.js y TypeScript lo entienden; el Node nativo NO
// ("Cannot find package '@/lib'"). Resultado: test-fechas.ts y test-importar-excel.ts no
// arrancaban, y test-fechas es el que vigila el peor fallo del proyecto (fechas en UTC).
//
// SOLUCIÓN sin tocar ningún módulo dorado: este cargador enseña a Node a resolver
//   - "@/xxx"            → <raíz>/xxx(.ts|.tsx|/index.ts|/index.tsx)
//   - "./xxx", "../xxx"  → el mismo fichero con extensión, si no la lleva
//
// USO (desde la raíz del proyecto):
//   node --import ./_pack/herramientas/alias-loader.mjs scripts/test-fechas.ts
// o todos a la vez:  node _pack/herramientas/correr-tests.mjs
//
// La raíz es el directorio actual, o la variable de entorno OBRA_RAIZ.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const raiz = path.resolve(process.env.OBRA_RAIZ ?? process.cwd());

const esFichero = (p) => existsSync(p) && statSync(p).isFile();

/** Prueba el sitio tal cual, con extensión, o como carpeta con index. */
function buscar(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (esFichero(c)) return c;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, siguiente) {
    let base = null;

    // SheetJS: Node coge la versión CommonJS (xlsx.js), donde `XLSX.SSF` no existe como export
    // con nombre y lib/importar-excel.ts falla ("reading 'parse_date_code'"). El navegador
    // (webpack/turbopack) usa la versión ESM; aquí hacemos lo mismo.
    if (specifier === "xlsx") {
      const esm = path.join(raiz, "node_modules", "xlsx", "xlsx.mjs");
      if (esFichero(esm)) return { url: pathToFileURL(esm).href, shortCircuit: true };
    }

    if (specifier.startsWith("@/")) {
      base = path.join(raiz, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      !path.extname(specifier)
    ) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (base) {
      const f = buscar(base);
      if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
    }
    return siguiente(specifier, context);
  },
});
