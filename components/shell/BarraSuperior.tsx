"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tipoSalto } from "@/lib/nav";
import { ChevronDown, ClipboardList } from "lucide-react";
import { tr } from "@/lib/i18n";
import type { Obra } from "@/lib/types";
import { Marca } from "@/components/marca/Logo";

/**
 * Barra superior (SHL-03), como la cabecera de la referencia:
 * - la marca (en el móvil) vuelve SIEMPRE a Inicio (petición de la dueña, T-12);
 * - el botón de la obra actual (punto + estado en palabra + nombre) abre el selector;
 * - gestores: atajo a Resumen en una tesela, donde la referencia tiene la campana.
 * Deja sitio a la barra de estado del iPhone instalado (zona segura, T-04).
 */
export function BarraSuperior({
  obra,
  gestiona,
  onElegirObra,
}: {
  obra: Obra | null;
  gestiona: boolean;
  onElegirObra: () => void;
}) {
  const cerrada = obra?.activa === false;
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-30 bg-fondo/85 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-md md:px-6"
      style={{ viewTransitionName: "cabecera" }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2.5">
        <Link
          href="/"
          transitionTypes={tipoSalto(pathname, "/")}
          aria-label={tr("Ir a inicio")}
          className="-m-1 inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] md:hidden"
        >
          <Marca size={38} />
        </Link>
        <button
          type="button"
          onClick={onElegirObra}
          aria-haspopup="dialog"
          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 text-left hover:bg-white/5"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-micro font-medium">
              <span
                aria-hidden
                className={clsx("size-2 rounded-full", cerrada ? "bg-tinta/50 ring-1 ring-tinta/60" : "bg-lima")}
              />
              {obra ? (cerrada ? tr("Cerrada") : tr("Activa")) : tr("Elegir obra")}
            </span>
            <span className="block truncate text-base font-medium leading-snug">{obra ? obra.nombre : tr("Elegir obra")}</span>
          </span>
          <ChevronDown size={18} aria-hidden className="shrink-0 opacity-80" />
        </button>
        {gestiona && (
          <Link
            href="/resumen"
            transitionTypes={tipoSalto(pathname, "/resumen")}
            aria-label={tr("Resumen mensual")}
            className="vidrio-tesela inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] hover:brightness-110"
          >
            <ClipboardList size={20} strokeWidth={1.8} aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
