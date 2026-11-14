import clsx from "clsx";
import { tr } from "@/lib/i18n";

/**
 * Indicador de carga con la forma de la marca: tres varillas que laten.
 * Respeta prefers-reduced-motion (globals.css apaga la animación).
 */
export function Cargando({
  tamano = "normal",
  claro,
  etiqueta,
  className,
}: {
  tamano?: "peq" | "normal" | "grande";
  /** Varillas blancas (sobre fondos oscuros) en vez de color de tinta. */
  claro?: boolean;
  /** Texto para lectores de pantalla (por defecto «Cargando…»). */
  etiqueta?: string;
  className?: string;
}) {
  const h = tamano === "peq" ? 14 : tamano === "grande" ? 34 : 22;
  const w = tamano === "peq" ? 3 : tamano === "grande" ? 6 : 4;
  return (
    <span role="status" className={clsx("inline-flex items-end gap-[3px]", className)} style={{ height: h }}>
      {[0.55, 0.8, 1].map((alto, i) => (
        <span
          key={i}
          className={clsx("anim-latido block rounded-[1px]", claro ? "bg-white" : i === 2 ? "bg-lima" : "bg-tinta")}
          style={{ width: w, height: `${alto * 100}%`, animationDelay: `${i * 160}ms` }}
        />
      ))}
      <span className="sr-only">{etiqueta ?? tr("Cargando…")}</span>
    </span>
  );
}

/** Carga a pantalla completa (o de bloque), centrada. */
export function CargandoBloque({ alto = "pantalla" }: { alto?: "pantalla" | "bloque" }) {
  return (
    <div
      className={clsx(
        "flex w-full items-center justify-center",
        alto === "pantalla" ? "min-h-[100dvh]" : "py-16"
      )}
    >
      <Cargando tamano="grande" />
    </div>
  );
}
