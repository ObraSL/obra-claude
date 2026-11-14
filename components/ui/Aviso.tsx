import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Avisos de pantalla (errores del servidor, cola sin conexión, información).
 * Llevan aria-live para que se anuncien. El error del servidor se enseña
 * tal cual llega (E-2): «La entrada ya está fichada…».
 *
 * - error: coral con texto casi negro (7.95:1)
 * - sin-conexion: casi negro con texto blanco y varilla lima que late
 * - info / ok: panel hondo con texto blanco
 */
export type TonoAviso = "error" | "sin-conexion" | "info" | "ok";

const ICONO: Record<TonoAviso, ReactNode> = {
  error: <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />,
  "sin-conexion": <WifiOff size={18} aria-hidden className="mt-px shrink-0 text-lima" />,
  info: <Info size={18} aria-hidden className="mt-px shrink-0" />,
  ok: <CheckCircle2 size={18} aria-hidden className="mt-px shrink-0 text-lima" />,
};

export function Aviso({
  tono,
  children,
  accion,
  className,
}: {
  tono: TonoAviso;
  children: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      aria-live={tono === "error" ? "assertive" : "polite"}
      className={clsx(
        "flex min-w-0 items-start gap-2.5 rounded-boton px-3.5 py-3 text-peq font-medium leading-snug",
        tono === "error" && "bg-coral text-sobre-coral",
        tono === "sin-conexion" && "bg-negro text-sobre-negro",
        (tono === "info" || tono === "ok") && "bg-sup-honda text-sobre-honda",
        className
      )}
    >
      {ICONO[tono]}
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {accion}
    </div>
  );
}
