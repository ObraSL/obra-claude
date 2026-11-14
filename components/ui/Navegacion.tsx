"use client";

import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { currentMonth, fmtDateLong, monthLabel, shiftDay, shiftMonth, todayStr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { BotonIcono } from "./Boton";

/**
 * Día anterior / siguiente (FIC-10, VEH-02, NOT-01). No se puede pasar de
 * hoy. «Volver a hoy» es un botón de verdad (≥ 44 px) y se parte en dos
 * líneas si el idioma lo pide (×1.9 en ucraniano, T-39).
 */
export function NavDia({ fecha, onCambio, className }: { fecha: string; onCambio: (f: string) => void; className?: string }) {
  const esHoy = fecha === todayStr();
  return (
    <div className={clsx("flex min-w-0 items-center gap-2", className)}>
      <BotonIcono onClick={() => onCambio(shiftDay(fecha, -1))} aria-label={tr("Día anterior")}>
        <ChevronLeft size={20} aria-hidden />
      </BotonIcono>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-titulo font-medium leading-tight tracking-[-0.01em] first-letter:uppercase" aria-live="polite">
          {fmtDateLong(fecha)}
        </p>
        {!esHoy && (
          <button
            type="button"
            onClick={() => onCambio(todayStr())}
            className="mx-auto mt-0.5 inline-flex min-h-11 items-center rounded-boton px-3 text-peq font-medium underline underline-offset-4"
          >
            {tr("Volver a hoy")}
          </button>
        )}
      </div>
      <BotonIcono onClick={() => onCambio(shiftDay(fecha, 1))} disabled={esHoy} aria-label={tr("Día siguiente")}>
        <ChevronRight size={20} aria-hidden />
      </BotonIcono>
    </div>
  );
}

/** Mes anterior / siguiente con «Mes actual» (RES-01). No se pasa del mes actual. */
export function NavMes({ mes, onCambio, className }: { mes: string; onCambio: (m: string) => void; className?: string }) {
  const actual = currentMonth();
  return (
    <div className={clsx("flex min-w-0 items-center gap-2", className)}>
      <BotonIcono onClick={() => onCambio(shiftMonth(mes, -1))} aria-label={tr("Mes anterior")}>
        <ChevronLeft size={20} aria-hidden />
      </BotonIcono>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-titulo font-medium leading-tight first-letter:uppercase" aria-live="polite">
          {monthLabel(mes)}
        </p>
        {mes !== actual && (
          <button
            type="button"
            onClick={() => onCambio(actual)}
            className="mx-auto mt-0.5 inline-flex min-h-11 items-center rounded-boton px-3 text-peq font-medium underline underline-offset-4"
          >
            {tr("Mes actual")}
          </button>
        )}
      </div>
      <BotonIcono onClick={() => onCambio(shiftMonth(mes, 1))} disabled={mes >= actual} aria-label={tr("Mes siguiente")}>
        <ChevronRight size={20} aria-hidden />
      </BotonIcono>
    </div>
  );
}

/**
 * Filtro «todos los meses / un mes» (GAS-03): sin mes, un botón «Filtrar por
 * mes»; con mes, flechas + «Ver todas».
 */
export function FiltroMes({
  mes,
  onCambio,
  onQuitar,
  sobre = "lienzo",
}: {
  mes: string | null;
  onCambio: (m: string) => void;
  onQuitar: () => void;
  sobre?: "lienzo" | "panel";
}) {
  if (!mes) {
    return (
      <button
        type="button"
        onClick={() => onCambio(currentMonth())}
        className="inline-flex min-h-11 items-center gap-2 rounded-boton px-1 text-peq font-medium"
      >
        <CalendarDays size={18} aria-hidden /> {tr("Filtrar por mes")}
      </button>
    );
  }
  return (
    <div className={clsx("flex min-w-0 flex-wrap items-center gap-1.5 rounded-boton p-1", sobre === "lienzo" ? "bg-sup" : "bg-fondo")}>
      <BotonIcono sobre="panel" onClick={() => onCambio(shiftMonth(mes, -1))} aria-label={tr("Mes anterior")}>
        <ChevronLeft size={18} aria-hidden />
      </BotonIcono>
      <span className="min-w-0 flex-1 text-center text-base font-medium first-letter:uppercase">{monthLabel(mes)}</span>
      <BotonIcono sobre="panel" onClick={() => onCambio(shiftMonth(mes, 1))} aria-label={tr("Mes siguiente")}>
        <ChevronRight size={18} aria-hidden />
      </BotonIcono>
      <button
        type="button"
        onClick={onQuitar}
        className="inline-flex min-h-11 items-center gap-1 rounded-boton px-3 text-peq font-medium"
      >
        <X size={16} aria-hidden /> {tr("Ver todas")}
      </button>
    </div>
  );
}
