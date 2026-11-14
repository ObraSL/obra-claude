import clsx from "clsx";
import { localeActual } from "@/lib/i18n";

/**
 * El avance en grande (HOM-02, PLA-01): la parte entera enorme y los dos
 * decimales más pequeños. Los decimales son de verdad, no de adorno: con
 * diez capítulos el avance casi nunca cae en un número redondo.
 *
 * v2: el separador decimal sigue el idioma activo y el redondeo se hace una
 * sola vez sobre el número entero (v1 podía pintar «60,100»: DIS-02).
 */
export function partesAvance(valor: number, decimales = 2) {
  const seguro = Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : 0;
  const partes = new Intl.NumberFormat(localeActual(), {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).formatToParts(seguro);
  const entero = partes.filter((p) => p.type === "integer" || p.type === "group").map((p) => p.value).join("");
  const separador = partes.find((p) => p.type === "decimal")?.value ?? ",";
  const fraccion = partes.find((p) => p.type === "fraction")?.value ?? "";
  return { entero, separador, fraccion, texto: `${entero}${fraccion ? separador + fraccion : ""} %` };
}

export function CifraAvance({
  valor,
  decimales = 2,
  tamano = "gigante",
  className,
}: {
  valor: number;
  decimales?: number;
  tamano?: "gigante" | "cifra";
  className?: string;
}) {
  const { entero, separador, fraccion, texto } = partesAvance(valor, decimales);
  return (
    <p className={clsx("cifras flex items-baseline font-light leading-none tracking-[-0.04em]", className)} aria-label={texto}>
      <span aria-hidden className={tamano === "gigante" ? "text-[4.25rem]" : "text-cifra"}>
        {entero}
      </span>
      {fraccion && (
        <span aria-hidden className={clsx("opacity-80", tamano === "gigante" ? "text-[2rem]" : "text-titulo")}>
          {separador}
          {fraccion}
        </span>
      )}
      <span aria-hidden className={clsx("ml-1.5 opacity-80", tamano === "gigante" ? "text-titulo" : "text-base")}>
        %
      </span>
    </p>
  );
}
