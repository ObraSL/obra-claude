/**
 * Comprobación de las cuentas del dinero: sumas al céntimo, balance de la
 * obra y la caja del dueño (lo que le da el jefe − lo que paga él).
 *
 * Uso:  node scripts/test-dinero.ts
 */
import assert from "node:assert/strict";
import { balanceObra, miCaja, pagadoPorMi, suma } from "../lib/dinero.ts";

// --- Sumas sin errores de decimales --------------------------------------

// Con números normales, 0.1 + 0.2 = 0.30000000000000004
assert.equal(suma([{ importe: 0.1 }, { importe: 0.2 }]), 0.3);
assert.equal(suma([{ importe: 10.1 }, { importe: 20.2 }, { importe: 30.3 }]), 60.6);
// Cien tickets de 0,01 € son 1 € justo
assert.equal(suma(Array.from({ length: 100 }, () => ({ importe: 0.01 }))), 1);

// Supabase devuelve los numeric como texto: tienen que sumar igual
assert.equal(suma([{ importe: "935.19" }, { importe: "317.20" }]), 1252.39);
assert.equal(suma([{ importe: null }, { importe: 5 }]), 5);
assert.equal(suma([]), 0);

// --- Pagado por mí --------------------------------------------------------

const gastos = [
  { importe: 2000, pagado_por: "personal" as const },
  { importe: 100, pagado_por: "personal" as const },
  { importe: 5000, pagado_por: "empresa" as const },
];
assert.equal(pagadoPorMi(gastos), 2100);

// --- Balance de la obra ---------------------------------------------------

// Cuenta TODO lo gastado en la obra, lo pagara quien lo pagara
const obra = balanceObra([{ importe: 10000 }, { importe: 2500 }], gastos);
assert.deepEqual(obra, { cobrado: 12500, gastado: 7100, balance: 5400 });

// Obra en pérdidas: el balance sale negativo
assert.equal(balanceObra([{ importe: 1000 }], gastos).balance, -6100);

// Sin cobros todavía
assert.equal(balanceObra([], gastos).balance, -7100);

// --- Mi caja (el ejemplo del dueño) ----------------------------------------

// El jefe me dio 2.500 €, yo pagué 2.100 € de mi mano → me quedan 400 €
const caja = miCaja([{ importe: 700 }, { importe: 1800 }], gastos);
assert.deepEqual(caja, { recibido: 2500, pagado: 2100, queda: 400 });

// Lo que pagó la empresa directamente NO toca mi caja
assert.equal(miCaja([{ importe: 2500 }], [{ importe: 9999, pagado_por: "empresa" }]).queda, 2500);

// Pagué más de lo que me dieron → la empresa me debe (sale negativo)
assert.equal(miCaja([{ importe: 700 }], gastos).queda, -1400);

// Sin entregas del jefe: todo lo que pagué me lo debe la empresa
assert.equal(miCaja([], gastos).queda, -2100);

// Céntimos en la caja también cuadran
assert.equal(
  miCaja([{ importe: 100.1 }], [{ importe: 50.05, pagado_por: "personal" }]).queda,
  50.05
);

console.log("✓ Todas las comprobaciones del dinero son correctas");
