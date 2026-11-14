// Ejecuta TODOS los tests de TypeScript del proyecto + la comprobación de traducciones,
// usando el cargador alias-loader.mjs (ver su cabecera para el porqué).
//
// USO, desde la raíz de tu proyecto:
//   node _pack/herramientas/correr-tests.mjs
// Opcional: ruta de un Gantt real para test-importar-excel:
//   node _pack/herramientas/correr-tests.mjs "C:\ruta\Gant.xlsx"
//
// Sale con código 0 solo si todo pasa. Imprime una línea por test.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = process.cwd();
const cargador = pathToFileURL(path.join(aqui, "alias-loader.mjs")).href;
const gantt = process.argv[2];

const tests = [
  { nombre: "test-horas", args: ["scripts/test-horas.ts"] },
  { nombre: "test-fechas", args: ["scripts/test-fechas.ts"] },
  { nombre: "test-gantt", args: ["scripts/test-gantt.ts"] },
  { nombre: "test-dinero", args: ["scripts/test-dinero.ts"] },
  { nombre: "test-importar-excel", args: ["scripts/test-importar-excel.ts", ...(gantt ? [gantt] : [])] },
];

let fallos = 0;
for (const t of tests) {
  const fichero = path.join(raiz, t.args[0]);
  if (!existsSync(fichero)) {
    console.log(`✗ ${t.nombre.padEnd(22)} no existe ${t.args[0]}`);
    fallos++;
    continue;
  }
  const r = spawnSync(process.execPath, ["--import", cargador, ...t.args], {
    cwd: raiz,
    env: { ...process.env, OBRA_RAIZ: raiz },
    encoding: "utf8",
  });
  const salida = `${r.stdout}\n${r.stderr}`;
  const ok = r.status === 0;
  // Un test que se salta porque no hay Gantt real también sale con 0: lo avisamos.
  const saltado = /comprobación saltada/i.test(salida);
  const linea = salida.split("\n").find((l) => /^✓|AssertionError|Error \[|⚠/.test(l)) ?? "";
  console.log(`${ok ? (saltado ? "⚠" : "✓") : "✗"} ${t.nombre.padEnd(22)} ${linea.trim().slice(0, 110)}`);
  if (!ok) fallos++;
}

// Traducciones: no debe faltar ninguna.
if (existsSync(path.join(raiz, "scripts/claves-i18n.js"))) {
  const r = spawnSync(process.execPath, ["scripts/claves-i18n.js"], { cwd: raiz, encoding: "utf8" });
  const salida = (r.stdout ?? "").trim();
  const faltan = /faltan|sin traducir|missing/i.test(salida) && !/(\d+)\/\1 traducidas/.test(salida);
  console.log(`${r.status === 0 && !faltan ? "✓" : "✗"} ${"claves-i18n".padEnd(22)} ${salida.split("\n").slice(0, 2).join(" | ")}`);
  if (r.status !== 0 || faltan) fallos++;
}

console.log(fallos === 0 ? "\nTODO CORRECTO" : `\n${fallos} con fallo`);
process.exit(fallos === 0 ? 0 : 1);
