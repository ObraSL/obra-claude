"use client";

import clsx from "clsx";
import type { Tarea } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { duracionDias, estadoTarea, mesesDelRango, posicionBarra, posicionDia, rangoObra, type EstadoTarea } from "@/lib/gantt";
import { localeActual, tr, trN } from "@/lib/i18n";
import { Etiqueta, type TonoEtiqueta } from "@/components/ui/Etiqueta";

/**
 * Las clases van escritas enteras a propósito: Tailwind busca los nombres de
 * clase tal cual en el código, así que algo como `bg-${color}` no generaría
 * el color y la barra saldría transparente.
 *
 * Hecho = lima; lo que queda = blanco (retrasada: coral); pendiente = solo el
 * carril. El estado nunca va solo en color: siempre lleva su palabra.
 */
const RESTO: Record<EstadoTarea, string> = {
  hecha: "bg-lima",
  en_marcha: "bg-white",
  retrasada: "bg-coral",
  pendiente: "bg-white/25",
};

const TONO: Record<EstadoTarea, { tono: TonoEtiqueta; clase?: string }> = {
  hecha: { tono: "lima" },
  en_marcha: { tono: "honda", clase: "ring-1 ring-inset ring-white/45" },
  retrasada: { tono: "coral" },
  pendiente: { tono: "suave" },
};

const palabra = (e: EstadoTarea) => {
  switch (e) {
    case "hecha":
      return tr("Terminada");
    case "en_marcha":
      return tr("En marcha");
    case "retrasada":
      return tr("Retrasada");
    default:
      return tr("Pendiente");
  }
};

/**
 * Escala de meses en el idioma activo. `mesesDelRango` da los anchos (y los
 * nombres en es-ES, que no sirven): el mes de cada tramo se deduce del primero
 * del rango. Los rótulos que no caben se descartan, no se recortan.
 */
function escalaMeses(rango: NonNullable<ReturnType<typeof rangoObra>>) {
  const [y, m] = rango.desde.split("-").map(Number);
  let izquierda = 0;
  let ocupadoHasta = 0;
  const etiquetas: { texto: string; izquierda: number }[] = [];
  mesesDelRango(rango).forEach((mes, i) => {
    const texto = new Date(y, m - 1 + i, 1).toLocaleDateString(localeActual(), { month: "short" }).replace(".", "");
    // ~3 % del ancho por letra (a 320 px) más un respiro.
    const ancho = texto.length * 3 + 1.5;
    if (izquierda >= ocupadoHasta && izquierda + ancho <= 100) {
      etiquetas.push({ texto, izquierda });
      ocupadoHasta = izquierda + ancho;
    }
    izquierda += mes.ancho;
  });
  return etiquetas;
}

/**
 * Diagrama de Gantt de la obra. Toda la obra se aprieta en el ancho de la
 * pantalla (cada barra se coloca en porcentaje), así se ve el plan entero de
 * un vistazo y no hace falta deslizar de lado — que en el iPhone daba
 * problemas y encima obliga a buscar dónde está cada cosa.
 */
export function Gantt({ tareas, hoy, onElegir }: { tareas: Tarea[]; hoy: string; onElegir: (t: Tarea) => void }) {
  const rango = rangoObra(tareas);
  if (!rango) return null;

  const meses = escalaMeses(rango);
  const posHoy = posicionDia(hoy, rango);

  return (
    <div className="relative" data-testid="gantt">
      {/* Línea de hoy: cruza todas las tareas para ver de un golpe qué
          debería estar ya terminado y qué no. */}
      {posHoy !== null && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white" style={{ left: `${posHoy}%` }} data-testid="gantt-hoy">
          <span
            className={clsx(
              "absolute top-0 w-max text-micro font-medium leading-none",
              posHoy < 8 ? "left-0" : posHoy > 92 ? "right-0" : "left-1/2 -translate-x-1/2"
            )}
          >
            {tr("Hoy")}
          </span>
          <span className="absolute left-1/2 top-3.5 size-1.5 -translate-x-1/2 rounded-full bg-white" />
        </div>
      )}

      {/* Escala de meses */}
      <div className="relative mt-5 h-5 overflow-hidden text-micro font-medium uppercase tracking-wide text-sobre-honda-2" aria-hidden>
        {meses.map((m, i) => (
          <span key={i} className="absolute top-0 w-max leading-5" style={{ left: `${m.izquierda}%` }}>
            {m.texto}
          </span>
        ))}
      </div>

      <ul className="grid gap-2 pt-1">
        {tareas.map((t) => {
          const estado = estadoTarea(t, hoy);
          const { izquierda, ancho } = posicionBarra(t, rango);
          const etiqueta = TONO[estado];

          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onElegir(t)}
                className="block min-h-14 w-full min-w-0 py-1.5 text-left"
                data-testid="gantt-fila"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words font-medium">{t.nombre}</span>
                  <span className="cifras shrink-0 font-medium">{t.avance}%</span>
                </span>

                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Etiqueta tono={etiqueta.tono} className={etiqueta.clase}>
                    {palabra(estado)}
                  </Etiqueta>
                  <span className="min-w-0 break-words text-peq text-sobre-honda-2">
                    {fmtDate(t.fecha_inicio)} – {fmtDate(t.fecha_fin)} · {trN(duracionDias(t), "{n} día", "{n} días")}
                  </span>
                </span>

                {/* Carril a todo el ancho; la barra se coloca en porcentaje.
                    El mínimo evita que una tarea de un día en una obra de un
                    año quede tan fina que no se vea. */}
                <span className="relative mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <span
                    className={clsx("absolute inset-y-0 overflow-hidden rounded-full", RESTO[estado])}
                    style={{ left: `${izquierda}%`, width: `${ancho}%`, minWidth: "6px" }}
                  >
                    <span className="block h-full rounded-full bg-lima" style={{ width: `${t.avance}%` }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
