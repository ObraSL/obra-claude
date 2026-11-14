/**
 * Cálculo de horas trabajadas a partir de la hora de entrada y de salida.
 *
 * Nota importante: se cuenta el tiempo completo entre entrada y salida, SIN
 * descontar la pausa de comida. Si algún día hay que descontarla, es aquí
 * donde se cambia.
 */

/** Minutos entre entrada y salida ("HH:MM"). null si falta algún dato o no cuadra. */
export function minutosTrabajados(
  entrada: string | null | undefined,
  salida: string | null | undefined
): number | null {
  if (!entrada || !salida) return null;
  const aMinutos = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  };
  const e = aMinutos(entrada);
  const s = aMinutos(salida);
  if (e === null || s === null) return null;
  // Salida anterior o igual a la entrada: dato incompleto o mal apuntado.
  if (s <= e) return null;
  return s - e;
}

/** Minutos que pasan de la jornada normal (los que cuentan como extra). */
export function minutosExtra(minutos: number | null, jornadaHoras: number): number {
  if (minutos === null) return 0;
  return Math.max(0, minutos - Math.round(jornadaHoras * 60));
}

/** "8h 30m" (o "8h" si son horas justas). "—" si no hay dato. */
export function fmtHoras(minutos: number | null): string {
  if (minutos === null) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Suma de minutos trabajados y extra de una lista de fichajes. */
export function totalesFichajes(
  fichajes: { hora_entrada: string | null; hora_salida: string | null }[],
  jornadaHoras: number
) {
  let trabajados = 0;
  let extra = 0;
  let sinCerrar = 0;

  for (const f of fichajes) {
    const min = minutosTrabajados(f.hora_entrada, f.hora_salida);
    if (min === null) {
      if (f.hora_entrada) sinCerrar++;
      continue;
    }
    trabajados += min;
    extra += minutosExtra(min, jornadaHoras);
  }

  return { trabajados, extra, sinCerrar };
}
