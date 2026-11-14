"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { BotonIcono } from "./Boton";

/**
 * Hoja inferior (en el ordenador, ventana centrada). Es el contenedor de
 * TODOS los formularios: lección T-08 de v1 — un campo con su botón pegado
 * abajo acababa debajo del teclado del móvil. Aquí la hoja se coloca encima
 * del teclado leyendo `visualViewport`, el cuerpo hace scroll y el `pie`
 * (botón principal) queda siempre a la vista y se puede tocar, también a
 * 320×568 con el teclado abierto.
 *
 * Accesible: role="dialog", aria-modal, título enlazado, Esc cierra, el foco
 * entra en la hoja y vuelve a donde estaba al cerrar.
 */
type Props = {
  titulo: ReactNode;
  /** Línea pequeña bajo el título (p. ej. la fecha larga). */
  subtitulo?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  /** Botones fijos abajo (acción principal). */
  pie?: ReactNode;
  /** Se puede cerrar tocando fuera. Falso cuando hay datos a medio escribir importantes. */
  cerrarFuera?: boolean;
  className?: string;
};

export function Hoja({ titulo, subtitulo, onCerrar, children, pie, cerrarFuera = true, className }: Props) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [teclado, setTeclado] = useState({ abajo: 0, alto: 0 });

  // Teclado del móvil: la hoja se apoya en el borde de la parte visible.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const abajo = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setTeclado({ abajo, alto: vv.height });
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);

  // Foco, Esc y bloqueo del scroll de fondo.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const primero = caja.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select, textarea, button:not([data-cerrar])"
    );
    (primero ?? caja.current)?.focus({ preventScroll: true });

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
      if (e.key === "Tab" && caja.current) {
        const foco = [...caja.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
          (el) => !el.hasAttribute("disabled")
        );
        if (foco.length === 0) return;
        const [a, z] = [foco[0], foco[foco.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.({ preventScroll: true });
    };
    // onCerrar cambia en cada render del padre; el efecto debe correr una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conTeclado = teclado.abajo > 40;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-scrim"
        style={{ animation: "velo-entra 200ms ease both" }}
        onClick={cerrarFuera ? onCerrar : undefined}
      />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        className={clsx(
          "relative flex w-full max-w-lg flex-col rounded-t-hoja bg-sup text-tinta outline-none md:rounded-hoja",
          "max-md:fixed max-md:inset-x-0",
          className
        )}
        style={{
          animation: "hoja-entra 320ms var(--ease-obra) both",
          bottom: conTeclado ? teclado.abajo : 0,
          maxHeight: conTeclado ? teclado.alto - 8 : "calc(100dvh - max(env(safe-area-inset-top), 12px) - 8px)",
        }}
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-2.5">
          <div className="min-w-0 flex-1 pt-3">
            <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-tinta/30 md:hidden" />
            <h2 id={`${id}-t`} className="text-titulo font-medium tracking-[-0.01em]">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-peq text-tinta-2">{subtitulo}</p>}
          </div>
          <BotonIcono sobre="panel" onClick={onCerrar} aria-label={tr("Cerrar")} data-cerrar className="mt-1.5">
            <X size={20} />
          </BotonIcono>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {pie && (
          <div
            className={clsx(
              "shrink-0 border-t border-linea px-5 pt-3",
              conTeclado ? "pb-3" : "pb-[max(env(safe-area-inset-bottom),16px)]"
            )}
          >
            {pie}
          </div>
        )}
        {!pie && <div className={conTeclado ? "h-2" : "h-[max(env(safe-area-inset-bottom),12px)]"} />}
      </div>
    </div>
  );
}
