/**
 * Comprobación de los cálculos de la planificación (Gantt): duración de las
 * tareas, dónde cae cada barra, el avance de la obra y la escala de meses.
 *
 * Se ejecuta en la zona horaria de España a propósito: los errores de fechas
 * que ya tuvimos solo se veían con UTC+1 / UTC+2.
 *
 * Uso:  node scripts/test-gantt.ts
 */
process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import {
  avanceObra,
  diasEntre,
  duracionDias,
  estadoTarea,
  mesesDelRango,
  posicionBarra,
  posicionDia,
  rangoObra,
} from "../lib/gantt.ts";
import type { Tarea } from "../lib/types.ts";

/** Tarea de mentira, solo con lo que hace falta para los cálculos. */
const tarea = (
  nombre: string,
  fecha_inicio: string,
  fecha_fin: string,
  avance = 0
): Tarea => ({
  id: nombre,
  obra_id: "obra",
  nombre,
  fecha_inicio,
  fecha_fin,
  avance,
  orden: 0,
  created_at: "",
});

// --- Días entre fechas -------------------------------------------------

assert.equal(diasEntre("2026-09-01", "2026-09-02"), 1);
assert.equal(diasEntre("2026-09-01", "2026-09-01"), 0);
assert.equal(diasEntre("2026-09-30", "2026-10-01"), 1);
assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);

// El cambio de hora de octubre (un día de 25 horas) no descuadra la cuenta
assert.equal(diasEntre("2026-10-24", "2026-10-26"), 2);
// Ni el de marzo (un día de 23 horas)
assert.equal(diasEntre("2026-03-28", "2026-03-30"), 2);

// Año bisiesto
assert.equal(diasEntre("2028-02-28", "2028-03-01"), 2);

// Una tarea de un solo día dura 1 día, no 0
assert.equal(duracionDias(tarea("x", "2026-09-01", "2026-09-01")), 1);
assert.equal(duracionDias(tarea("x", "2026-09-01", "2026-09-10")), 10);

// --- Rango de la obra --------------------------------------------------

const tareas = [
  tarea("Cimentación", "2026-09-01", "2026-09-30", 100),
  tarea("Estructura", "2026-10-01", "2026-11-30", 50),
  tarea("Tabiquería", "2026-11-15", "2026-12-31", 0),
];

const rango = rangoObra(tareas);
assert.ok(rango);
// Coge la fecha más temprana y la más tardía, aunque las tareas se solapen
assert.equal(rango.desde, "2026-09-01");
assert.equal(rango.hasta, "2026-12-31");
assert.equal(rango.dias, 122); // sep 30 + oct 31 + nov 30 + dic 31

assert.equal(rangoObra([]), null);

// El orden en que llegan las tareas no cambia el rango
const alReves = rangoObra([...tareas].reverse());
assert.deepEqual(alReves, rango);

// --- Posición de las barras -------------------------------------------

const primera = posicionBarra(tareas[0], rango);
// La primera tarea empieza justo al principio
assert.equal(primera.izquierda, 0);
// Y ocupa sus 30 días de los 122 de la obra
assert.equal(Math.round(primera.ancho), Math.round((30 / 122) * 100));

const ultima = posicionBarra(tareas[2], rango);
// La última termina justo al final: izquierda + ancho = 100 %
assert.ok(Math.abs(ultima.izquierda + ultima.ancho - 100) < 0.001);

// Ninguna barra se sale del diagrama
for (const t of tareas) {
  const { izquierda, ancho } = posicionBarra(t, rango);
  assert.ok(izquierda >= 0 && izquierda <= 100);
  assert.ok(izquierda + ancho <= 100.001);
}

// --- La línea de "hoy" -------------------------------------------------

assert.equal(posicionDia("2026-09-01", rango), 0);
assert.equal(posicionDia("2026-08-31", rango), null); // antes de empezar
assert.equal(posicionDia("2027-01-01", rango), null); // después de acabar
const mitad = posicionDia("2026-11-01", rango);
assert.ok(mitad !== null && mitad > 45 && mitad < 55);

// --- Avance de la obra -------------------------------------------------

// Se pesa por días: la de 30 días al 100 % y la de 61 al 50 % no valen igual
// (30·100 + 61·50 + 47·0) / 138 días = 43,66… → 44 %
assert.equal(avanceObra(tareas), 44);

assert.equal(avanceObra([]), 0);
assert.equal(avanceObra([tarea("a", "2026-09-01", "2026-09-10", 100)]), 100);
assert.equal(avanceObra([tarea("a", "2026-09-01", "2026-09-10", 0)]), 0);

// Dos tareas iguales al 100 % y al 0 % dan la mitad
assert.equal(
  avanceObra([
    tarea("a", "2026-09-01", "2026-09-10", 100),
    tarea("b", "2026-09-11", "2026-09-20", 0),
  ]),
  50
);

// Una tarea larga sin empezar pesa más que una corta terminada
assert.ok(
  avanceObra([
    tarea("corta", "2026-09-01", "2026-09-02", 100),
    tarea("larga", "2026-09-03", "2026-12-31", 0),
  ]) < 10
);

// --- Estado de cada tarea ----------------------------------------------

const hoy = "2026-11-01";
assert.equal(estadoTarea(tarea("a", "2026-09-01", "2026-09-30", 100), hoy), "hecha");
// Terminó en septiembre y no está al 100 %: va retrasada
assert.equal(estadoTarea(tarea("a", "2026-09-01", "2026-09-30", 80), hoy), "retrasada");
// Empezó y aún no ha llegado su fecha de fin
assert.equal(estadoTarea(tarea("a", "2026-10-01", "2026-11-30", 50), hoy), "en_marcha");
// Todavía no le toca
assert.equal(estadoTarea(tarea("a", "2026-12-01", "2026-12-31", 0), hoy), "pendiente");
// Justo hoy empieza: ya está en marcha
assert.equal(estadoTarea(tarea("a", hoy, "2026-12-31", 0), hoy), "en_marcha");
// Termina hoy y no está acabada: aún no cuenta como retrasada
assert.equal(estadoTarea(tarea("a", "2026-10-01", hoy, 30), hoy), "en_marcha");
// Está al 100 % aunque se pasara de fecha: terminada, no retrasada
assert.equal(estadoTarea(tarea("a", "2026-09-01", "2026-09-30", 100), hoy), "hecha");

// --- Escala de meses ---------------------------------------------------

const meses = mesesDelRango(rango);
assert.equal(meses.length, 4); // sep, oct, nov, dic
assert.deepEqual(
  meses.map((m) => m.etiqueta),
  ["sept", "oct", "nov", "dic"]
);
// Los anchos suman el 100 % del diagrama
assert.ok(Math.abs(meses.reduce((s, m) => s + m.ancho, 0) - 100) < 0.001);

// Una obra que empieza a mitad de mes: ese mes ocupa solo los días que toca
const corto = rangoObra([tarea("a", "2026-09-20", "2026-10-10")]);
assert.ok(corto);
const mesesCorto = mesesDelRango(corto);
assert.equal(mesesCorto.length, 2);
assert.equal(Math.round(mesesCorto[0].ancho), Math.round((11 / 21) * 100)); // 20–30 sept
assert.ok(Math.abs(mesesCorto.reduce((s, m) => s + m.ancho, 0) - 100) < 0.001);

// Obra de un solo día: un mes que ocupa todo el ancho
const unDia = rangoObra([tarea("a", "2026-09-07", "2026-09-07")]);
assert.ok(unDia);
assert.equal(unDia.dias, 1);
assert.equal(mesesDelRango(unDia).length, 1);
assert.equal(mesesDelRango(unDia)[0].ancho, 100);

// Obra que cruza el fin de año
const cruzaAnio = rangoObra([tarea("a", "2026-12-15", "2027-01-15")]);
assert.ok(cruzaAnio);
assert.equal(cruzaAnio.dias, 32);
assert.equal(mesesDelRango(cruzaAnio).length, 2);

console.log("✓ Todas las comprobaciones de la planificación son correctas");
