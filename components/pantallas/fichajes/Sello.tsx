"use client";

import clsx from "clsx";
import { Check, type LucideIcon } from "lucide-react";
import { tr } from "@/lib/i18n";
import { Cargando } from "@/components/ui/Cargando";

/**
 * EL SELLO — momento firma nº 2 (concepto.md). Una losa por fichaje:
 *
 *  · libre      → lima con texto casi negro (12.97:1, AAA): «tócame».
 *  · pendiente  → casi negra con varillas que laten y «Enviando…»: el toque
 *                 está guardado en el móvil y saldrá solo (FIC-08).
 *  · sellada    → casi negra con la HORA DEL SERVIDOR en grande (18.2:1, AAA)
 *                 y una marca ✓. Entera y nítida: es un sello hecho, no un
 *                 botón roto.
 *  · bloqueada  → contorno discontinuo (la salida antes de la entrada).
 *
 * Una hora ya fichada NO se vuelve a fichar encima (antes un segundo toque
 * la machacaba y se podía salir a las 14:00 y volver a marcar «Salida» a
 * las 20:00 desde casa). Corregir es cosa del dueño, aparte. Pendiente
 * tampoco se toca: ya está en cola y otro toque duplicaría el intento.
 */
export function Sello({
  etiqueta,
  hora,
  icono: Icono,
  onFichar,
  bloqueada,
  pendiente,
  recien,
  compacto,
}: {
  etiqueta: string;
  /** Hora devuelta por el servidor ('HH:MM') o nada. */
  hora: string | null | undefined;
  icono: LucideIcon;
  onFichar: () => void;
  /** Todavía no se puede fichar (p. ej. salida sin entrada). */
  bloqueada?: boolean;
  /** En cola sin conexión. */
  pendiente?: boolean;
  /** Acaba de sellarse en esta sesión: cae con la animación del sello. */
  recien?: boolean;
  /** Versión baja para las tarjetas de la cuadrilla. */
  compacto?: boolean;
}) {
  const sellada = !!hora;
  const libre = !sellada && !pendiente && !bloqueada;

  return (
    <button
      type="button"
      onClick={onFichar}
      disabled={!libre}
      aria-label={
        sellada
          ? `${etiqueta}: ${hora}`
          : pendiente
            ? `${etiqueta}: ${tr("Enviando…")}`
            : etiqueta
      }
      className={clsx(
        "relative flex min-w-0 flex-1 flex-col justify-between overflow-hidden rounded-[10px] text-left transition-[transform,filter] duration-150",
        compacto ? "min-h-[68px] px-3 py-2" : "min-h-[124px] px-4 py-3.5",
        libre && "bg-lima text-sobre-lima active:scale-[0.97] hover:brightness-[1.03]",
        (sellada || pendiente) && "bg-negro text-sobre-negro",
        bloqueada && !sellada && !pendiente && "border-2 border-dashed border-current bg-transparent opacity-45"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={clsx("min-w-0 break-words font-medium leading-tight", compacto ? "text-peq" : "text-base")}>{etiqueta}</span>
        {sellada ? (
          <Check size={compacto ? 16 : 20} aria-hidden className="shrink-0 text-lima" strokeWidth={2.4} />
        ) : (
          <Icono size={compacto ? 18 : 24} aria-hidden className="shrink-0" strokeWidth={1.8} />
        )}
      </span>

      {pendiente ? (
        <span className="flex items-end gap-2">
          <Cargando tamano={compacto ? "peq" : "normal"} claro etiqueta={tr("Enviando…")} />
          <span className={clsx("font-medium", compacto ? "text-peq" : "text-base")} aria-hidden>
            {tr("Enviando…")}
          </span>
        </span>
      ) : (
        <span
          className={clsx(
            "cifras block font-light leading-none tracking-[-0.04em]",
            compacto ? "text-[1.625rem]" : "text-[2.75rem]",
            recien && sellada && "anim-sello",
            !sellada && "opacity-70"
          )}
          aria-hidden
        >
          {hora || "—:—"}
        </span>
      )}
    </button>
  );
}

/** Hora ya fijada de otro día (solo lectura): mismo aspecto que un sello hecho, sin ser botón. */
export function HoraFija({ etiqueta, hora }: { etiqueta: string; hora: string | null | undefined }) {
  return (
    <div className="flex min-h-[92px] min-w-0 flex-1 flex-col justify-between rounded-[10px] bg-white/10 px-4 py-3">
      <span className="text-base font-medium leading-tight">{etiqueta}</span>
      <span className={clsx("cifras text-[2.25rem] font-light leading-none tracking-[-0.04em]", !hora && "opacity-60")}>
        {hora || "—"}
      </span>
    </div>
  );
}
