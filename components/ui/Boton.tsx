"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Cargando } from "./Cargando";

/**
 * Botones. Esquinas casi rectas (6 px) como en la referencia; una sola
 * altura mínima de 48 px (52 con texto largo) y 60 px para las acciones de
 * obra (fichar, guardar en una hoja): se aciertan con guantes y al sol.
 *
 * - principal: lima con texto casi negro (12.97:1, AAA)
 * - secundario: casi negro con texto blanco (18.2:1, AAA)
 * - suave: superficie del tema con texto del tema
 * - peligro: coral con texto casi negro (7.95:1, AAA) — borrar, quitar
 * - fantasma: solo texto, para acciones terciarias
 */
export type VarianteBoton = "principal" | "secundario" | "suave" | "peligro" | "fantasma";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  grande?: boolean;
  ancho?: boolean;
  cargando?: boolean;
  icono?: ReactNode;
};

const VARIANTE: Record<VarianteBoton, string> = {
  principal: "bg-lima text-sobre-lima hover:brightness-[1.04] active:brightness-95",
  secundario: "bg-negro text-sobre-negro hover:brightness-125 active:brightness-110",
  suave: "bg-sup text-tinta hover:brightness-110 active:brightness-95",
  peligro: "bg-coral text-sobre-coral hover:brightness-[1.04] active:brightness-95",
  fantasma: "bg-transparent text-tinta underline-offset-4 hover:underline",
};

export function Boton({
  variante = "principal",
  grande,
  ancho,
  cargando,
  icono,
  className,
  children,
  disabled,
  type = "button",
  ...resto
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clsx(
        "inline-flex min-w-0 select-none items-center justify-center gap-2 rounded-boton px-5 text-center font-medium leading-tight",
        "transition-[filter,transform,opacity] duration-150 active:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        grande ? "min-h-[60px] py-3 text-[1.0625rem]" : "min-h-12 py-2.5 text-base",
        ancho && "w-full",
        VARIANTE[variante],
        className
      )}
      {...resto}
    >
      {cargando ? <Cargando tamano="peq" claro={variante === "secundario"} /> : icono}
      {children != null && <span className="min-w-0 text-balance">{children}</span>}
    </button>
  );
}

/** Tesela cuadrada de 44×44 para iconos (volver, cerrar, opciones), como la de la referencia. */
export function BotonIcono({
  className,
  children,
  type = "button",
  sobre = "lienzo",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { sobre?: "lienzo" | "panel" | "honda" }) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] transition-[filter,transform] active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-35",
        sobre === "lienzo" && "bg-sup-alta/70 text-tinta hover:brightness-110",
        sobre === "panel" && "bg-fondo/60 text-tinta hover:brightness-110",
        sobre === "honda" && "bg-white/12 text-sobre-honda hover:bg-white/20",
        className
      )}
      {...resto}
    >
      {children}
    </button>
  );
}
