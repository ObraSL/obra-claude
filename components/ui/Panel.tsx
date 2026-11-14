import clsx from "clsx";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Paneles. Sin bordes ni sombras en reposo: se separan por un paso de tono
 * (lienzo → sup → sup-honda), como en la referencia.
 *
 * - "sup": tarjetas normales (texto del tema).
 * - "honda": paneles de datos — cifras de dinero, varillas, listas con
 *   importes. Siempre salvia hondo con texto blanco, en los dos temas
 *   (7.2:1, AAA para las cifras).
 */
type Props = HTMLAttributes<HTMLElement> & {
  tono?: "sup" | "honda";
  como?: "section" | "div" | "article";
  relleno?: "normal" | "compacto" | "ninguno";
};

export function Panel({ tono = "sup", como = "section", relleno = "normal", className, children, ...resto }: Props) {
  const Tag = como;
  return (
    <Tag
      className={clsx(
        "min-w-0 rounded-panel",
        tono === "sup" ? "bg-sup text-tinta" : "bg-sup-honda text-sobre-honda",
        relleno === "normal" && "p-4",
        relleno === "compacto" && "p-3",
        className
      )}
      {...resto}
    >
      {children}
    </Tag>
  );
}

/** Cabecera de bloque: título a la izquierda y, opcional, un enlace «ver más» a la derecha. */
export function CabeceraBloque({
  titulo,
  enlace,
  textoEnlace,
  como: Tag = "h2",
  className,
  extra,
}: {
  titulo: ReactNode;
  enlace?: string;
  textoEnlace?: string;
  como?: "h2" | "h3";
  className?: string;
  extra?: ReactNode;
}) {
  return (
    <div className={clsx("flex min-w-0 items-baseline justify-between gap-3", className)}>
      <Tag className="min-w-0 text-titulo font-medium tracking-[-0.01em]">{titulo}</Tag>
      {extra}
      {enlace && textoEnlace && (
        <Link
          href={enlace}
          className="-my-3 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-peq opacity-90 hover:opacity-100"
        >
          {textoEnlace}
          <ChevronRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}
