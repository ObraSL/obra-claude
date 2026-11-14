import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Etiqueta de estado, rectangular como el «On Track» de la referencia.
 * El texto lleva siempre el significado (nunca solo el color).
 */
export type TonoEtiqueta = "honda" | "lima" | "coral" | "negro" | "suave" | "vidrio";

const TONO: Record<TonoEtiqueta, string> = {
  honda: "bg-sup-honda text-sobre-honda",
  lima: "bg-lima text-sobre-lima",
  coral: "bg-coral text-sobre-coral",
  negro: "bg-negro text-sobre-negro",
  suave: "bg-fondo text-tinta",
  // Para ir SOBRE la foto, como el «On Track» de la referencia: cristal oscuro (7:1 aun sobre cielo blanco).
  vidrio: "bg-[rgb(20_22_19/0.68)] text-white ring-1 ring-inset ring-white/20 backdrop-blur-md",
};

export function Etiqueta({
  tono = "honda",
  icono,
  children,
  className,
}: {
  tono?: TonoEtiqueta;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-peq font-medium leading-tight",
        TONO[tono],
        className
      )}
    >
      {icono}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
