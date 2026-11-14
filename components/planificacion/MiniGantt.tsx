import clsx from "clsx";
import type { Tarea } from "@/lib/types";
import { estadoTarea, posicionBarra, posicionDia, rangoObra, type EstadoTarea } from "@/lib/gantt";

const COLOR: Record<EstadoTarea, string> = {
  hecha: "bg-lima",
  en_marcha: "bg-white",
  retrasada: "bg-coral",
  pendiente: "bg-white/25",
};

/** Filas visibles como máximo: la portada no tiene que crecer con el plan. */
const MAX_FILAS = 10;

/**
 * El Gantt en miniatura para la portada: solo las barras (4 px), sin nombres
 * ni fechas, y la línea de hoy. Va dentro de un panel hondo. Es solo vista:
 * sin interacción.
 */
export function MiniGantt({ tareas, hoy }: { tareas: Tarea[]; hoy: string }) {
  const rango = rangoObra(tareas);
  if (!rango) return null;
  const posHoy = posicionDia(hoy, rango);

  return (
    <div aria-hidden className="relative flex flex-col gap-1" data-testid="mini-gantt">
      {posHoy !== null && <div className="absolute inset-y-0 z-10 w-px bg-white" style={{ left: `${posHoy}%` }} />}
      {tareas.slice(0, MAX_FILAS).map((t) => {
        const { izquierda, ancho } = posicionBarra(t, rango);
        return (
          <div key={t.id} className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx("absolute inset-y-0 rounded-full", COLOR[estadoTarea(t, hoy)])}
              style={{ left: `${izquierda}%`, width: `${ancho}%`, minWidth: "4px" }}
            />
          </div>
        );
      })}
    </div>
  );
}
