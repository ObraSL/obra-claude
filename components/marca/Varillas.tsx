import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * VARILLAS — el segundo elemento firma: barras verticales finas, como la
 * ferralla en espera, que cuentan una magnitud real (días del plan, horas
 * de cada día, euros del presupuesto). Nunca alturas inventadas: cada
 * varilla sale de un dato.
 *
 * Va siempre sobre un panel hondo (sup-honda): ahí el blanco da 7.2:1, la
 * lima 5.2:1 y el coral 3.2:1 (≥ 3:1 para gráficos, WCAG 1.4.11). El color
 * nunca es el único portador del dato: cada gráfico lleva su cifra en texto
 * y un `resumen` para lectores de pantalla.
 *
 * Se maqueta con flex en porcentajes: ocupa exactamente el ancho que tenga
 * y no puede desbordar de lado (T-06/T-07).
 */
export type TonoVarilla = "lima" | "blanco" | "coral" | "apagado";

export type Varilla = {
  /** 0–1: proporción de la altura máxima. */
  alto: number;
  tono: TonoVarilla;
  /** Texto corto para el tooltip nativo (opcional). */
  titulo?: string;
};

const TONO: Record<TonoVarilla, string> = {
  lima: "bg-lima",
  blanco: "bg-white",
  coral: "bg-coral",
  apagado: "bg-white/25",
};

type Props = {
  varillas: Varilla[];
  /** Altura del gráfico en px. */
  alto?: number;
  /** Marca vertical (p. ej. «hoy») en proporción 0–1 del ancho, con su texto debajo. */
  marca?: { posicion: number; etiqueta?: ReactNode };
  /** Resumen para lectores de pantalla (obligatorio: el gráfico es una imagen). */
  resumen: string;
  /** Anima el crecimiento al montar. */
  animar?: boolean;
  className?: string;
  /** Grosor relativo de la varilla frente al hueco (0–1). */
  grosor?: number;
};

export function Varillas({ varillas, alto = 72, marca, resumen, animar = true, className, grosor = 0.42 }: Props) {
  const n = Math.max(1, varillas.length);
  return (
    <div className={clsx("relative w-full min-w-0", className)}>
      <div role="img" aria-label={resumen} className="flex w-full items-end" style={{ height: alto }}>
        {varillas.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center" title={v.titulo}>
            <div
              className={clsx("rounded-[1px]", TONO[v.tono], animar && "origin-bottom")}
              style={{
                width: `${Math.round(grosor * 100)}%`,
                minWidth: 2,
                height: `${Math.max(4, Math.min(1, Math.max(0, v.alto)) * 100)}%`,
                animation: animar ? `varilla 520ms var(--ease-obra) ${Math.round((i / n) * 380)}ms both` : undefined,
              }}
            />
          </div>
        ))}
      </div>
      {marca && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${Math.min(100, Math.max(0, marca.posicion * 100))}%`, height: alto + 8 }}
        >
          <span className="mt-auto block h-full w-px bg-white/80" />
          <span className="-mt-[3px] block size-[7px] rounded-full bg-white" />
        </div>
      )}
      {marca?.etiqueta && (
        <div
          className="relative mt-3 h-6"
          aria-hidden
        >
          <span
            className="cifras absolute -translate-x-1/2 whitespace-nowrap text-titulo font-normal text-sobre-honda"
            style={{ left: `clamp(2.5rem, ${Math.min(100, Math.max(0, marca.posicion * 100))}%, calc(100% - 2.5rem))` }}
          >
            {marca.etiqueta}
          </span>
        </div>
      )}
    </div>
  );
}
