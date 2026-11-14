/**
 * Comprobación rápida del cálculo de horas trabajadas y extra.
 * Uso:  node scripts/test-horas.ts
 */
import assert from "node:assert/strict";
import { fmtHoras, minutosExtra, minutosTrabajados, totalesFichajes } from "../lib/horas.ts";

// Jornada de 8 h: de 8:00 a 18:00 son 10 h → 2 h extra
assert.equal(minutosTrabajados("08:00", "18:00"), 600);
assert.equal(minutosExtra(600, 8), 120);
assert.equal(fmtHoras(600), "10h");
assert.equal(fmtHoras(120), "2h");

// Jornada justa: sin extra
assert.equal(minutosExtra(minutosTrabajados("08:00", "16:00"), 8), 0);

// Media hora suelta
assert.equal(minutosTrabajados("07:30", "16:15"), 525);
assert.equal(fmtHoras(525), "8h 45m");
assert.equal(minutosExtra(525, 8), 45);

// Datos incompletos o mal apuntados → sin dato (no inventamos horas)
assert.equal(minutosTrabajados("08:00", null), null);
assert.equal(minutosTrabajados(null, "18:00"), null);
assert.equal(minutosTrabajados("18:00", "08:00"), null);
assert.equal(fmtHoras(null), "—");
assert.equal(minutosExtra(null, 8), 0);

// Jornada distinta (6 h)
assert.equal(minutosExtra(minutosTrabajados("09:00", "16:00"), 6), 60);

// Totales del mes: 2 días completos + 1 sin cerrar
const totales = totalesFichajes(
  [
    { hora_entrada: "08:00", hora_salida: "18:00" }, // 10h → 2h extra
    { hora_entrada: "08:00", hora_salida: "16:00" }, // 8h  → 0
    { hora_entrada: "08:00", hora_salida: null }, // sin salida
  ],
  8
);
assert.deepEqual(totales, { trabajados: 1080, extra: 120, sinCerrar: 1 });
assert.equal(fmtHoras(totales.trabajados), "18h");

console.log("✓ Todas las comprobaciones de horas son correctas");
