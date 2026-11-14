"use client";

import clsx from "clsx";
import { IDIOMAS } from "@/lib/i18n";
import { useIdioma } from "@/lib/i18n/provider";

/** ES / UA / EN (ACC-13). Cada opción es un objetivo de 44 px. */
export function SelectorIdioma({ className, sobre = "lienzo" }: { className?: string; sobre?: "lienzo" | "panel" }) {
  const { idioma, cambiarIdioma } = useIdioma();
  return (
    <div
      role="group"
      aria-label="Idioma · Мова · Language"
      className={clsx("inline-flex rounded-boton p-1", sobre === "lienzo" ? "bg-sup" : "bg-fondo", className)}
    >
      {IDIOMAS.map((i) => (
        <button
          key={i.id}
          type="button"
          lang={i.id}
          onClick={() => cambiarIdioma(i.id)}
          aria-label={i.nombre}
          aria-pressed={idioma === i.id}
          className={clsx(
            "min-h-11 min-w-11 rounded-[5px] px-2.5 text-peq font-semibold transition-colors",
            idioma === i.id ? "bg-negro text-sobre-negro" : "text-tinta"
          )}
        >
          {i.corto}
        </button>
      ))}
    </div>
  );
}
