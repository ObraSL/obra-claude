"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { fmtDate, fmtEUR } from "@/lib/format";
import { suma } from "@/lib/dinero";
import { tituloGasto } from "@/lib/gastos";
import type { Gasto } from "@/lib/types";
import { tr, trJsx, trN } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { VisorArchivo } from "@/components/ui/VisorArchivo";
import { PagadoPorBadge } from "@/components/ui/PagadoPor";

/**
 * Los gastos de una categoría del mes (RES-04). Tocar uno con foto o PDF
 * enseña el recibo (en la misma hoja: así nunca hay dos hojas apiladas).
 */
export function HojaCategoriaGastos({
  categoria,
  registros,
  cargarUrl,
  onCerrar,
}: {
  categoria: string;
  /** Ya ordenados del más reciente al más antiguo. */
  registros: Gasto[];
  cargarUrl: (path: string) => Promise<{ data: string | null; error: { message: string } | null }>;
  onCerrar: () => void;
}) {
  const [recibo, setRecibo] = useState<Gasto | null>(null);

  if (recibo?.recibo_path) {
    const path = recibo.recibo_path;
    return (
      <Hoja titulo={tr("Recibo")} onCerrar={() => setRecibo(null)}>
        <div className="grid gap-3 pt-1">
          <p className="break-words text-base text-tinta-2">
            <span className="font-semibold text-tinta">{tituloGasto(recibo)}</span> · {fmtDate(recibo.fecha)} · {fmtEUR(recibo.importe)}
          </p>
          <VisorArchivo clave={path} tipo={recibo.recibo_tipo} cargarUrl={() => cargarUrl(path)} />
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo={tr(categoria)} onCerrar={onCerrar}>
      <div className="grid gap-3 pt-1">
        <p className="text-base text-tinta-2">
          {trJsx("Total: {importe}", { importe: <b className="cifras text-tinta">{fmtEUR(suma(registros))}</b> })} ·{" "}
          {trN(registros.length, "{n} gasto", "{n} gastos")}
        </p>
        <ul className="grid gap-1.5" data-testid="lista-gastos-categoria">
          {registros.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => g.recibo_path && setRecibo(g)}
                disabled={!g.recibo_path}
                className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] bg-fondo/60 px-3 py-2.5 text-left disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start gap-1.5">
                    <span className="min-w-0 break-words text-base font-semibold">{tituloGasto(g)}</span>
                    {g.recibo_path && (
                      <span role="img" aria-label={tr("Con foto o PDF")} className="mt-0.5 shrink-0">
                        <Camera size={16} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-peq text-tinta-2">
                    <span>{fmtDate(g.fecha)}</span>
                    <PagadoPorBadge pagadoPor={g.pagado_por} />
                  </span>
                </span>
                <span className="cifras shrink-0 whitespace-nowrap text-base font-semibold">{fmtEUR(g.importe)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Hoja>
  );
}
