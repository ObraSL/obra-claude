import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Estado vacío: tres varillas «por levantar» (contorno) y el texto de v1.
 * Nada de ilustraciones de stock.
 */
export function Vacio({
  titulo,
  texto,
  accion,
  className,
  sobre = "panel",
}: {
  titulo: ReactNode;
  texto?: ReactNode;
  accion?: ReactNode;
  className?: string;
  sobre?: "panel" | "honda";
}) {
  return (
    <div className={clsx("flex flex-col items-center px-4 py-10 text-center", className)}>
      <span aria-hidden className="mb-4 flex h-9 items-end gap-[5px]">
        {[0.45, 0.7, 1].map((a, i) => (
          <span
            key={i}
            className={clsx(
              "block w-[5px] rounded-[1px] border-[1.5px] border-dashed",
              sobre === "honda" ? "border-white/60" : "border-current opacity-60"
            )}
            style={{ height: `${a * 100}%` }}
          />
        ))}
      </span>
      <p className="text-base font-medium">{titulo}</p>
      {texto && <p className={clsx("mt-1 max-w-[30ch] text-peq", sobre === "honda" ? "text-sobre-honda-2" : "text-tinta-2")}>{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
