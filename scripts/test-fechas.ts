/**
 * Comprobación del manejo de fechas: pasar de día, volver a hoy y los
 * límites de mes. Se ejecuta en la zona horaria de España a propósito,
 * porque el error que teníamos solo se veía con UTC+1 / UTC+2.
 *
 * Uso:  node scripts/test-fechas.ts
 */
process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import { monthBounds, shiftDay, shiftMonth, todayStr } from "../lib/format.ts";

// Un día para atrás es UN día, no dos (esto es lo que fallaba: 7 → 5 → 3)
assert.equal(shiftDay("2026-09-07", -1), "2026-09-06");
assert.equal(shiftDay("2026-09-06", -1), "2026-09-05");

// Un día para adelante avanza de verdad (antes se quedaba clavado)
assert.equal(shiftDay("2026-09-03", 1), "2026-09-04");
assert.equal(shiftDay("2026-09-04", 1), "2026-09-05");

// Ir y volver deja la misma fecha
assert.equal(shiftDay(shiftDay("2026-09-07", -1), 1), "2026-09-07");

// En verano (UTC+2) y en invierno (UTC+1) se comporta igual
assert.equal(shiftDay("2026-01-15", -1), "2026-01-14");
assert.equal(shiftDay("2026-01-15", 1), "2026-01-16");

// El cambio de hora (España: 25/10/2026 a las 03:00) no se come un día
assert.equal(shiftDay("2026-10-25", -1), "2026-10-24");
assert.equal(shiftDay("2026-10-25", 1), "2026-10-26");
assert.equal(shiftDay("2026-03-29", -1), "2026-03-28");

// Saltos de mes y de año
assert.equal(shiftDay("2026-09-01", -1), "2026-08-31");
assert.equal(shiftDay("2026-08-31", 1), "2026-09-01");
assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");

// Año bisiesto
assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
assert.equal(shiftDay("2028-03-01", -1), "2028-02-29");

// Los 7 días del gráfico de Inicio son 7 días seguidos y distintos
const serie = [];
for (let i = 6; i >= 0; i--) serie.push(shiftDay("2026-09-07", -i));
assert.deepEqual(serie, [
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
  "2026-09-07",
]);

// "Hoy" es el de aquí: a las 00:30 de la noche sigue siendo hoy, no ayer
const hoy = todayStr();
assert.match(hoy, /^\d{4}-\d{2}-\d{2}$/);
const ahora = new Date();
assert.equal(Number(hoy.slice(8, 10)), ahora.getDate());
assert.equal(Number(hoy.slice(5, 7)), ahora.getMonth() + 1);

// Límites de mes para filtrar en la base de datos
assert.deepEqual(monthBounds("2026-09"), { desde: "2026-09-01", hasta: "2026-10-01" });
assert.deepEqual(monthBounds("2026-12"), { desde: "2026-12-01", hasta: "2027-01-01" });
assert.equal(shiftMonth("2026-01", -1), "2025-12");

console.log("✓ Todas las comprobaciones de fechas son correctas");
