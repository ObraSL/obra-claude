"use client";

import { weekdayShort } from "@/lib/format";
import { fmtHoras, minutosExtra, minutosTrabajados, totalesFichajes } from "@/lib/horas";
import type { Fichaje } from "@/lib/types";
import { tr, trN } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Etiqueta } from "@/components/ui/Etiqueta";

/**
 * Detalle del mes de un trabajador (RES-02). A diferencia del resto del
 * resumen, aquí se muestran TODAS las obras (no solo la seleccionada): así se
 * ve dónde estuvo cada día, que es justo lo que hace falta para pagar y controlar.
 */
export function HojaMesTrabajador({
  nombre,
  registros,
  error,
  jornadaHoras,
  nombreObra,
  onCerrar,
}: {
  nombre: string;
  /** null = todavía cargando. */
  registros: Fichaje[] | null;
  error: string;
  jornadaHoras: number;
  nombreObra: (id: string) => string;
  onCerrar: () => void;
}) {
  const diasTrabajados = registros?.filter((r) => r.hora_entrada).length ?? 0;
  const { trabajados, extra, sinCerrar } = totalesFichajes(registros ?? [], jornadaHoras);

  return (
    <Hoja titulo={nombre} onCerrar={onCerrar}>
      <div className="grid gap-3 pt-1">
        {error && <Aviso tono="error">{error}</Aviso>}

        {registros === null && !error ? (
          <CargandoBloque alto="bloque" />
        ) : registros && registros.length === 0 ? (
          <Vacio titulo={tr("Sin fichajes este mes")} />
        ) : registros ? (
          <>
            <div className="grid gap-2 rounded-[10px] bg-fondo/60 p-3.5" data-testid="mes-trabajador-totales">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-base">
                <span className="min-w-0 text-tinta-2">
                  {trN(diasTrabajados, "{n} día", "{n} días")} · {tr("todas las obras")}
                </span>
                <span className="cifras whitespace-nowrap font-semibold">{fmtHoras(trabajados)}</span>
              </div>
              {extra > 0 && (
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-base">
                  <span className="min-w-0 text-tinta-2">{tr("Horas extra")}</span>
                  <span className="cifras whitespace-nowrap font-semibold">{fmtHoras(extra)}</span>
                </div>
              )}
              {sinCerrar > 0 && (
                <p>
                  <Etiqueta tono="coral">
                    {trN(
                      sinCerrar,
                      "{n} día sin hora de salida (no cuenta en el total)",
                      "{n} días sin hora de salida (no cuenta en el total)"
                    )}
                  </Etiqueta>
                </p>
              )}
            </div>

            <ul className="grid gap-1.5">
              {registros.map((r) => {
                const min = minutosTrabajados(r.hora_entrada, r.hora_salida);
                const diaExtra = minutosExtra(min, jornadaHoras);
                return (
                  <li key={r.id} className="flex min-h-14 min-w-0 items-center gap-3 rounded-[10px] bg-fondo/60 px-3 py-2.5">
                    <span className="cifras min-w-14 shrink-0 text-peq font-semibold">{weekdayShort(r.fecha)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-semibold">{nombreObra(r.obra_id)}</span>
                      <span className="block break-words text-peq text-tinta-2">
                        {r.hora_entrada || "—:—"}–{r.hora_salida || "—:—"}
                        {r.ubicacion ? ` · ${r.ubicacion}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="cifras block whitespace-nowrap text-base font-semibold">{fmtHoras(min)}</span>
                      {diaExtra > 0 && <span className="cifras block whitespace-nowrap text-peq font-medium">+{fmtHoras(diaExtra)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </Hoja>
  );
}
