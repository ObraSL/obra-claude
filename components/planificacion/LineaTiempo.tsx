import clsx from "clsx";
import type { Tarea } from "@/lib/types";
import { estadoTarea, posicionBarra, posicionDia, rangoObra, type EstadoTarea } from "@/lib/gantt";
import { localeActual } from "@/lib/i18n";

/**
 * LA LÍNEA DE TIEMPO ESCALONADA — el «Project Timeline» de la referencia:
 * las fases en escalera (la primera abajo a la izquierda, cada una más arriba
 * y más a la derecha), su nombre encima, el mes debajo y la línea punteada de
 * hoy con su punto sobre la fase que está en marcha.
 *
 * Es un resumen: enseña como mucho 4 fases (las que están alrededor de hoy) y
 * es decorativa (`aria-hidden`); el diagrama completo, con todas las tareas, su
 * estado en palabra y sus fechas, está justo debajo. Colores como en el Gantt:
 * lima = hecho, blanco = lo que queda, coral = retrasada.
 */
const MAX_FASES = 4;
const ALTO_NIVEL = 38; // px: nombre (14) + barra (6) + mes (14) + respiro

const RESTO: Record<EstadoTarea, string> = {
  hecha: "bg-lima",
  en_marcha: "bg-white",
  retrasada: "bg-coral",
  pendiente: "bg-white/30",
};

/** «oct. 2026» en el idioma activo, sin pasar por toISOString (T-01). */
function mesAnio(f: string) {
  const [y, m, d] = f.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeActual(), { month: "short", year: "numeric" }).replace(".", "").replace(/\s?р\.$/, "");
}

export function LineaTiempo({ tareas, hoy, className }: { tareas: Tarea[]; hoy: string; className?: string }) {
  const rango = rangoObra(tareas);
  if (!rango) return null;

  const ordenadas = [...tareas].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  // Ventana de fases alrededor de hoy: desde la última terminada hasta cuatro.
  const primeraPendiente = ordenadas.findIndex((t) => estadoTarea(t, hoy) !== "hecha");
  const desde = Math.max(0, Math.min((primeraPendiente === -1 ? ordenadas.length : primeraPendiente) - 1, ordenadas.length - MAX_FASES));
  const fases = ordenadas.slice(desde, desde + MAX_FASES);
  const n = fases.length;
  const posHoy = posicionDia(hoy, rango);
  const activa = fases.findIndex((t) => estadoTarea(t, hoy) === "en_marcha");

  return (
    <div
      aria-hidden
      className={clsx("relative", className)}
      style={{ height: n * ALTO_NIVEL + 6 }}
      data-testid="linea-tiempo"
    >
      {posHoy !== null && (
        <div
          className="absolute top-0 border-l border-dashed border-white/60"
          style={{ left: `${posHoy}%`, height: n * ALTO_NIVEL + 6 }}
        />
      )}

      {fases.map((t, i) => {
        const estado = estadoTarea(t, hoy);
        const { izquierda, ancho } = posicionBarra(t, rango);
        const arriba = (n - 1 - i) * ALTO_NIVEL; // la primera, abajo
        const alDerecha = izquierda + ancho > 72; // el rótulo se ancla al final para no salirse
        return (
          <div key={t.id} className="absolute inset-x-0" style={{ top: arriba, height: ALTO_NIVEL }}>
            <span
              className={clsx("absolute top-0 block max-w-[62%] truncate text-micro font-medium leading-[14px]", alDerecha && "text-right")}
              style={alDerecha ? { right: `${100 - (izquierda + ancho)}%` } : { left: `${izquierda}%` }}
            >
              {t.nombre}
            </span>
            <span
              className={clsx("absolute top-[17px] h-1.5 overflow-hidden rounded-full", RESTO[estado])}
              style={{ left: `${izquierda}%`, width: `${ancho}%`, minWidth: "6px" }}
            >
              <span className="block h-full rounded-full bg-lima" style={{ width: `${t.avance}%` }} />
            </span>
            <span className="absolute top-[15px] size-2.5 -translate-x-1/2 rounded-full bg-white" style={{ left: `${izquierda}%` }} />
            <span
              className={clsx("absolute top-6 block whitespace-nowrap text-micro leading-[14px] text-sobre-honda-2", alDerecha && "text-right")}
              style={alDerecha ? { right: `${100 - (izquierda + ancho)}%` } : { left: `${izquierda}%` }}
            >
              {mesAnio(t.fecha_inicio)}
            </span>
            {i === activa && posHoy !== null && (
              <span className="absolute top-[14px] size-3 -translate-x-1/2 rounded-full bg-white ring-2 ring-sup-honda" style={{ left: `${posHoy}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
