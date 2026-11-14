import clsx from "clsx";
import { ViewTransition } from "react";

/**
 * LA FOTO DE LA OBRA — portada de Inicio, Planificación y la pantalla pública.
 *
 * Sustituye al dibujo isométrico (Edificio) en las pantallas: es la forma de la
 * referencia (foto de obra arriba que se funde con el lienzo salvia). La foto es
 * de Adrian Cogua (Unsplash License; ver ENTREGA/CREDITOS-FOTO.md), recortada y
 * comprimida a dos tamaños que viven en /public/fotos (nada se pide a terceros
 * al abrir la app: regla N11).
 *
 * Es decorativa: no lleva texto alternativo y se oculta a los lectores de
 * pantalla; el avance real lo dicen la cifra y las varillas que van debajo.
 * El tamaño y el sangrado los decide quien la usa por `className`.
 */
export function FotoObra({ className, prioritaria = false }: { className?: string; prioritaria?: boolean }) {
  return (
    // Con nombre: al pasar de Inicio a Planificación (u otra pantalla con foto) la
    // foto no desaparece y reaparece, sino que se transforma de un tamaño al otro.
    <ViewTransition name="foto-obra" share="morph" default="none">
      <div aria-hidden className={clsx("foto-obra", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fotos/obra-1200.webp"
          srcSet="/fotos/obra-700.webp 700w, /fotos/obra-1200.webp 1200w"
          sizes="(min-width: 768px) 60vw, 100vw"
          width={1200}
          height={973}
          alt=""
          decoding="async"
          fetchPriority={prioritaria ? "high" : "auto"}
          className="foto-obra__img"
        />
        <div className="foto-obra__tinte" />
      </div>
    </ViewTransition>
  );
}
