"use client";

import { weekdayShort } from "@/lib/format";
import type { UsoVehiculo } from "@/lib/types";
import { tr, trN } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { CargandoBloque } from "@/components/ui/Cargando";

/**
 * El mes de un coche en TODAS las obras (como con los trabajadores): así se
 * ve de un vistazo por dónde anduvo cada día (RES-03).
 */
export function HojaMesVehiculo({
  nombre,
  registros,
  error,
  nombreObra,
  nombreConductor,
  onCerrar,
}: {
  nombre: string;
  /** null = todavía cargando. */
  registros: UsoVehiculo[] | null;
  error: string;
  nombreObra: (id: string) => string;
  nombreConductor: (id: string | null) => string | undefined;
  onCerrar: () => void;
}) {
  const dias = new Set((registros ?? []).map((r) => r.fecha)).size;

  return (
    <Hoja titulo={nombre} onCerrar={onCerrar}>
      <div className="grid gap-3 pt-1">
        {error && <Aviso tono="error">{error}</Aviso>}

        {registros === null && !error ? (
          <CargandoBloque alto="bloque" />
        ) : registros && registros.length === 0 ? (
          <Vacio titulo={tr("No se usó este mes")} />
        ) : registros ? (
          <>
            <p className="text-base text-tinta-2" data-testid="mes-vehiculo-dias">
              {trN(dias, "{n} día de uso", "{n} días de uso")} · {tr("todas las obras")}
            </p>
            <ul className="grid gap-1.5">
              {registros.map((r) => (
                <li key={r.id} className="flex min-h-14 min-w-0 items-center gap-3 rounded-[10px] bg-fondo/60 px-3 py-2.5">
                  <span className="cifras min-w-14 shrink-0 text-peq font-semibold">{weekdayShort(r.fecha)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-base font-semibold">{nombreObra(r.obra_id)}</span>
                    <span className="block break-words text-peq text-tinta-2">
                      {[nombreConductor(r.conductor_id), r.destino].filter(Boolean).join(" · ") || tr("Sin más datos")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Hoja>
  );
}
