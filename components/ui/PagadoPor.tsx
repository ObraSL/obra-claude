"use client";

import clsx from "clsx";
import { Building2, Wallet } from "lucide-react";
import type { PagadoPor } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { Etiqueta } from "./Etiqueta";

/**
 * Selector de quién puso el dinero (solo el dueño lo ve). Por defecto la
 * empresa: así, si no se toca nada, el gasto queda como pago de la empresa
 * (que es lo normal) y solo hay que marcar lo que pagó el dueño de su mano.
 *
 * Se dice «lo pagué yo» y no «mi dinero» a propósito: puede ser dinero que
 * le dio el jefe para gastos. Por eso cuenta en «mi caja».
 */
export function PagadoPorSelector({ valor, onChange }: { valor: PagadoPor; onChange: (v: PagadoPor) => void }) {
  const opciones: { id: PagadoPor; texto: string; Icono: typeof Wallet }[] = [
    { id: "empresa", texto: tr("La empresa"), Icono: Building2 },
    { id: "personal", texto: tr("Lo pagué yo"), Icono: Wallet },
  ];

  return (
    <div role="radiogroup" aria-label={tr("¿Quién lo pagó?")} className="flex gap-2.5">
      {opciones.map(({ id, texto, Icono }) => {
        const activo = valor === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(id)}
            className={clsx(
              "flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[10px] px-2 py-2.5 text-center text-peq font-medium leading-tight transition-colors",
              activo ? "bg-negro text-sobre-negro" : "bg-fondo/60 text-tinta hover:bg-fondo"
            )}
          >
            <Icono size={18} aria-hidden className={clsx("shrink-0", activo && "text-lima")} />
            <span className="min-w-0 break-words">{texto}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta para las listas. Solo se muestra en lo que pagó el dueño. */
export function PagadoPorBadge({ pagadoPor }: { pagadoPor: PagadoPor }) {
  if (pagadoPor !== "personal") return null;
  return (
    <Etiqueta tono="lima" icono={<Wallet size={14} aria-hidden className="shrink-0" />}>
      {tr("Pagué yo")}
    </Etiqueta>
  );
}
