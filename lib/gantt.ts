import type { Tarea } from "@/lib/types";

/**
 * Cálculos de la planificación (diagrama de Gantt).
 *
 * Igual que en `format.ts`: las fechas son cadenas "YYYY-MM-DD" y NUNCA se
 * pasan por `toISOString()`, que las convertiría a hora de Greenwich y
 * restaría un día. Aquí solo se construyen `Date` con el constructor local
 * (año, mes, día) para poder restar, y se vuelve a texto a mano.
 *
 * Como "YYYY-MM-DD" se ordena igual alfabéticamente que en el calendario,
 * para comparar fechas basta con `<` y `>` entre cadenas.
 */

const aDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Días enteros de "a" a "b" (b − a). Se redondea a propósito: en los cambios
 * de hora (marzo y octubre) un día dura 23 o 25 horas y sin redondear
 * saldrían 0,96 días.
 */
export const diasEntre = (a: string, b: string) =>
  Math.round((aDate(b).getTime() - aDate(a).getTime()) / 86400000);

/** Cuánto dura una tarea contando el primer y el último día. */
export const duracionDias = (t: Pick<Tarea, "fecha_inicio" | "fecha_fin">) =>
  diasEntre(t.fecha_inicio, t.fecha_fin) + 1;

export type Rango = { desde: string; hasta: string; dias: number };

/** De cuándo a cuándo va toda la obra: de la tarea más temprana a la más tardía. */
export function rangoObra(tareas: Tarea[]): Rango | null {
  if (tareas.length === 0) return null;
  let desde = tareas[0].fecha_inicio;
  let hasta = tareas[0].fecha_fin;
  for (const t of tareas) {
    if (t.fecha_inicio < desde) desde = t.fecha_inicio;
    if (t.fecha_fin > hasta) hasta = t.fecha_fin;
  }
  return { desde, hasta, dias: diasEntre(desde, hasta) + 1 };
}

/**
 * Dónde va la barra de una tarea dentro del ancho total, en porcentaje.
 * Así el diagrama entero cabe en la pantalla del móvil sin desplazarse
 * de lado (que en el iPhone daba problemas).
 */
export function posicionBarra(t: Tarea, rango: Rango) {
  const izquierda = (diasEntre(rango.desde, t.fecha_inicio) / rango.dias) * 100;
  const ancho = (duracionDias(t) / rango.dias) * 100;
  return { izquierda, ancho };
}

/** Dónde cae un día dentro del rango, en porcentaje. null si queda fuera. */
export function posicionDia(fecha: string, rango: Rango): number | null {
  if (fecha < rango.desde || fecha > rango.hasta) return null;
  return (diasEntre(rango.desde, fecha) / rango.dias) * 100;
}

/**
 * Avance de la obra: media de los avances de las tareas, pero pesando cada
 * una por lo que dura. Si no, una tarea de un día pesaría lo mismo que la
 * estructura entera.
 */
export function avanceObraExacto(
  tareas: Pick<Tarea, "fecha_inicio" | "fecha_fin" | "avance">[]
): number {
  let dias = 0;
  let hechos = 0;
  for (const t of tareas) {
    const d = duracionDias(t);
    dias += d;
    hechos += (d * t.avance) / 100;
  }
  return dias === 0 ? 0 : (hechos / dias) * 100;
}

/** El mismo avance redondeado, que es como se enseña casi siempre. */
export function avanceObra(
  tareas: Pick<Tarea, "fecha_inicio" | "fecha_fin" | "avance">[]
): number {
  return Math.round(avanceObraExacto(tareas));
}

/**
 * En qué estado está una tarea respecto a hoy, para darle color:
 * terminada, en marcha, pendiente, o retrasada (pasó su fecha de fin
 * y no está al 100 %).
 */
export type EstadoTarea = "hecha" | "retrasada" | "en_marcha" | "pendiente";

export function estadoTarea(t: Tarea, hoy: string): EstadoTarea {
  if (t.avance >= 100) return "hecha";
  if (t.fecha_fin < hoy) return "retrasada";
  if (t.fecha_inicio <= hoy) return "en_marcha";
  return "pendiente";
}

/** Los meses que abarca la obra, con el ancho que ocupa cada uno en %. */
export function mesesDelRango(rango: Rango) {
  const meses: { etiqueta: string; ancho: number }[] = [];
  const fin = aDate(rango.hasta);
  const cursor = aDate(rango.desde);
  cursor.setDate(1);

  while (cursor <= fin) {
    const inicioMes = aISO(cursor);
    const siguiente = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const finMes = aISO(new Date(siguiente.getTime() - 86400000));

    // Recorta el primer y el último mes a lo que realmente abarca la obra.
    const desde = inicioMes < rango.desde ? rango.desde : inicioMes;
    const hasta = finMes > rango.hasta ? rango.hasta : finMes;
    const dias = diasEntre(desde, hasta) + 1;

    meses.push({
      etiqueta: cursor.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
      ancho: (dias / rango.dias) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}
