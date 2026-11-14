"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Campos de formulario. Siempre claros (papel) con texto casi negro en los
 * dos temas: es lo que mejor se lee al sol. 17 px para que iOS no haga zoom.
 * La etiqueta va siempre visible encima (nunca solo placeholder).
 */
const CONTROL =
  "block w-full min-w-0 rounded-boton border border-campo-borde bg-campo px-3.5 text-campo text-sobre-campo " +
  "placeholder:text-campo-pista focus:border-transparent focus:outline-3 focus:outline-offset-0 focus:outline-foco " +
  "disabled:opacity-60 aria-[invalid=true]:border-coral";

export function Campo({
  etiqueta,
  pista,
  error,
  children,
  htmlFor,
  className,
}: {
  etiqueta: ReactNode;
  pista?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={clsx("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-peq font-medium">
        {etiqueta}
      </label>
      {children}
      {pista && !error && <p className="mt-1.5 text-peq text-tinta-2">{pista}</p>}
      {error && (
        <p role="alert" className="mt-1.5 rounded-[5px] bg-coral px-2.5 py-1.5 text-peq font-medium text-sobre-coral">
          {error}
        </p>
      )}
    </div>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...resto },
  ref
) {
  return <input ref={ref} className={clsx(CONTROL, "h-12", className)} {...resto} />;
});

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Selector(
  { className, children, ...resto },
  ref
) {
  return (
    <select ref={ref} className={clsx(CONTROL, "h-12 appearance-none bg-[length:12px] pr-9", className)} {...resto}>
      {children}
    </select>
  );
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto(
  { className, ...resto },
  ref
) {
  return <textarea ref={ref} className={clsx(CONTROL, "min-h-24 py-3", className)} {...resto} />;
});

/**
 * Hora con botón propio de borrar (T-09: en iPhone un <input type="time">
 * no se puede dejar vacío a mano).
 */
export function EntradaHora({
  valor,
  onCambio,
  etiqueta,
  textoBorrar,
  id: idDado,
  invalido,
}: {
  valor: string;
  onCambio: (v: string) => void;
  etiqueta: string;
  /** Nombre accesible del botón × (p. ej. «Quitar la hora de entrada»). */
  textoBorrar: string;
  id?: string;
  invalido?: boolean;
}) {
  const idAuto = useId();
  const id = idDado ?? idAuto;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-peq font-medium">
        {etiqueta}
      </label>
      <div className="flex min-w-0 items-stretch gap-1.5">
        <input
          id={id}
          type="time"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          aria-invalid={invalido || undefined}
          className={clsx(CONTROL, "cifras h-12 flex-1")}
        />
        <button
          type="button"
          onClick={() => onCambio("")}
          disabled={!valor}
          aria-label={textoBorrar}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-boton bg-campo text-sobre-campo disabled:opacity-35"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
