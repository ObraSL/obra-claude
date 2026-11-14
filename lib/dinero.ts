import type { PagadoPor } from "@/lib/types";

/**
 * Cuentas del dinero. Se suma en céntimos y no en euros con decimales: con
 * decimales, 0,10 + 0,20 da 0,30000000000000004 y al final de mes los
 * totales salían con un céntimo de más o de menos.
 */

type ConImporte = { importe: number | string | null };

/** Suma de importes, redondeada al céntimo. */
export function suma(items: ConImporte[]): number {
  let centimos = 0;
  for (const i of items) centimos += Math.round(Number(i.importe || 0) * 100);
  return centimos / 100;
}

/** Lo que pagó el dueño de su mano (de su bolsillo o del dinero del jefe). */
export function pagadoPorMi(gastos: (ConImporte & { pagado_por: PagadoPor })[]): number {
  return suma(gastos.filter((g) => g.pagado_por === "personal"));
}

/**
 * Cómo va una obra: lo que ha pagado el cliente menos todo lo gastado en
 * ella (lo pagara la empresa o el dueño, da igual: es coste de la obra).
 */
export function balanceObra(cobros: ConImporte[], gastos: ConImporte[]) {
  const cobrado = suma(cobros);
  const gastado = suma(gastos);
  return { cobrado, gastado, balance: Math.round((cobrado - gastado) * 100) / 100 };
}

/**
 * La caja del dueño, de todas las obras juntas: lo que le ha dado el jefe
 * menos lo que ha pagado él de su mano. Si sale en positivo, le queda ese
 * dinero de la empresa para gastos; si sale en negativo, la empresa se lo
 * debe a él.
 */
export function miCaja(
  entregas: ConImporte[],
  gastos: (ConImporte & { pagado_por: PagadoPor })[]
) {
  const recibido = suma(entregas);
  const pagado = pagadoPorMi(gastos);
  return { recibido, pagado, queda: Math.round((recibido - pagado) * 100) / 100 };
}
