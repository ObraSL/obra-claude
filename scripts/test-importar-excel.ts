/**
 * Comprueba el lector de Gantt de Excel contra un archivo de verdad.
 *
 * Uso:  node scripts/test-importar-excel.ts "ruta/al/Gant.xlsx"
 *
 * Sin ruta usa el archivo del cliente si está sincronizado en OneDrive.
 * No hay un .xlsx metido en el proyecto a propósito: son datos reales de una
 * obra y pesan más de un mega.
 */
process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerPlanExcel } from "../lib/importar-excel.ts";

// Se lee a memoria y se usa XLSX.read (no readFile), que es exactamente lo
// que hace el navegador con el archivo que elige el usuario.

const RUTA =
  process.argv[2] ?? "C:/Users/Test/OneDrive/Documentos/Gant Banus.xlsx";

if (!existsSync(RUTA)) {
  console.log(`⚠ No está el archivo "${RUTA}" — comprobación saltada.`);
  process.exit(0);
}

const wb = XLSX.read(readFileSync(RUTA), { cellStyles: true, sheetStubs: true });
const r = leerPlanExcel(wb);

console.log(`Hoja: "${r.hoja}" · ${r.semanas} semanas · año ${r.anio}`);
for (const s of r.secciones) {
  console.log(
    `  ${s.nombre.slice(0, 46).padEnd(48)} ${s.fecha_inicio} → ${s.fecha_fin}  ${String(s.lineas).padStart(2)} líneas  ${s.presupuesto.toFixed(2).padStart(10)} €`
  );
}
console.log(`  TOTAL: ${r.totalPresupuesto.toFixed(2)} €`);
if (r.avisos.length) console.log("Avisos:", r.avisos);

// --- Comprobaciones sobre el archivo del cliente ------------------------

if (RUTA.includes("Gant Banus")) {
  assert.equal(r.hoja, "Proyect PlanningGant");
  assert.equal(r.semanas, 15);

  // El año no está escrito en el Excel: se deduce de que la primera semana
  // empieza en lunes. 16.03.2026 fue lunes.
  assert.equal(r.anio, 2026);

  assert.equal(r.secciones.length, 10);

  // La obra entera va del 16 de marzo al 19 de junio
  const inicios = r.secciones.map((s) => s.fecha_inicio).sort();
  const fines = r.secciones.map((s) => s.fecha_fin).sort();
  assert.equal(inicios[0], "2026-03-16");
  assert.equal(fines[fines.length - 1], "2026-06-19");

  // Primera sección: demoliciones, dos semanas, 16 líneas
  const demol = r.secciones[0];
  assert.match(demol.nombre, /ДЕМОНТАЖ/);
  assert.equal(demol.fecha_inicio, "2026-03-16");
  assert.equal(demol.fecha_fin, "2026-03-27");
  assert.equal(demol.lineas, 16);
  assert.equal(Math.round(demol.presupuesto), 10221);

  // Ninguna sección puede acabar antes de empezar
  for (const s of r.secciones) {
    assert.ok(s.fecha_fin >= s.fecha_inicio, `${s.nombre} termina antes de empezar`);
    assert.match(s.fecha_inicio, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(s.fecha_fin, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(s.lineas > 0);
  }

  // El presupuesto total del plan
  assert.equal(Math.round(r.totalPresupuesto), 85706);

  // Las "TOTAL CHAPTER" son sumas, no capítulos: no deben colarse
  assert.ok(!r.secciones.some((s) => /^TOTAL/i.test(s.nombre)));

  // Y el año forzado manda sobre el adivinado
  const en2027 = leerPlanExcel(wb, 2027);
  assert.equal(en2027.anio, 2027);
  assert.equal(en2027.secciones[0].fecha_inicio, "2027-03-16");

  console.log("\n✓ El lector de Excel saca el plan correcto del archivo del cliente");
}
