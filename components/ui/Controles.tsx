"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { tr } from "@/lib/i18n";
import { Boton } from "./Boton";

/** Interruptor accesible (role="switch"), con la descripción debajo. 44 px de alto mínimo. */
export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  descripcion,
  disabled,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: ReactNode;
  descripcion?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className="flex min-h-11 w-full min-w-0 items-start justify-between gap-4 rounded-boton py-2 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-base font-medium">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-peq text-tinta-2">{descripcion}</span>}
      </span>
      <span
        aria-hidden
        className={clsx(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          activo ? "bg-lima" : "bg-fondo ring-1 ring-inset ring-tinta/30"
        )}
      >
        <span
          className={clsx(
            "absolute size-5 rounded-full shadow-sm transition-transform duration-200",
            activo ? "translate-x-6 bg-negro" : "translate-x-1 bg-tinta/70"
          )}
        />
      </span>
    </button>
  );
}

/**
 * Selector segmentado (pestañas, filtros). Las opciones se parten en varias
 * líneas cuando no caben: NUNCA scroll horizontal (T-06).
 */
export function Segmentos<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  className,
}: {
  opciones: { valor: T; texto: ReactNode }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={clsx("flex min-w-0 flex-wrap gap-1 rounded-boton bg-sup p-1", className)}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(o.valor)}
            className={clsx(
              "min-h-11 min-w-0 flex-1 basis-auto rounded-[5px] px-3 py-2 text-peq font-medium leading-tight transition-colors",
              activo ? "bg-negro text-sobre-negro" : "text-tinta hover:bg-fondo/50"
            )}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Borrado en dos pasos (como en v1): primero «Borrar», luego «Sí, borrar» /
 * «Cancelar». El segundo paso caduca solo a los 6 s.
 */
export function BorrarDosPasos({
  onBorrar,
  texto = tr("Borrar"),
  confirmar = tr("Sí, borrar"),
  pregunta,
  cargando,
  ancho = true,
}: {
  onBorrar: () => void;
  texto?: string;
  confirmar?: string;
  pregunta?: ReactNode;
  cargando?: boolean;
  ancho?: boolean;
}) {
  const [paso, setPaso] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  if (!paso) {
    return (
      <Boton
        variante="suave"
        ancho={ancho}
        icono={<Trash2 size={18} aria-hidden />}
        onClick={() => {
          setPaso(true);
          temporizador.current = setTimeout(() => setPaso(false), 6000);
        }}
      >
        {texto}
      </Boton>
    );
  }
  return (
    <div className="grid gap-2" role="group" aria-live="polite">
      {pregunta && <p className="text-peq font-medium">{pregunta}</p>}
      <div className="flex flex-wrap gap-2">
        <Boton variante="peligro" className="flex-1" cargando={cargando} onClick={onBorrar} icono={<Trash2 size={18} aria-hidden />}>
          {confirmar}
        </Boton>
        <Boton variante="suave" className="flex-1" onClick={() => setPaso(false)}>
          {tr("Cancelar")}
        </Boton>
      </div>
    </div>
  );
}
