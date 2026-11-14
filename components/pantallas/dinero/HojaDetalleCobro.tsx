"use client";

import { fmtDate, fmtEUR } from "@/lib/format";
import type { Cobro } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Aviso } from "@/components/ui/Aviso";
import { BorrarDosPasos } from "@/components/ui/Controles";
import { VisorArchivo } from "@/components/ui/VisorArchivo";

/** Detalle de un pago del cliente (DIN-04): datos, justificante y Borrar en dos pasos. */
export function HojaDetalleCobro({
  cobro,
  error,
  borrando,
  cargarUrl,
  onBorrar,
  onCerrar,
}: {
  cobro: Cobro;
  error: string;
  borrando: boolean;
  /** Pide la URL firmada del justificante. */
  cargarUrl: (path: string) => Promise<{ data: string | null; error: { message: string } | null }>;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const path = cobro.archivo_path;
  return (
    <Hoja titulo={tr("Pago del cliente")} onCerrar={onCerrar}>
      <div className="grid gap-4 pt-1">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-40">
            <p className="break-words text-base font-semibold">{cobro.concepto || tr("Pago del cliente")}</p>
            <p className="mt-0.5 text-peq text-tinta-2">{fmtDate(cobro.fecha)}</p>
          </div>
          <p className="cifras whitespace-nowrap text-titulo font-medium" data-testid="detalle-cobro-importe">
            +{fmtEUR(cobro.importe)}
          </p>
        </div>

        {path && <VisorArchivo clave={path} tipo={cobro.archivo_tipo} cargarUrl={() => cargarUrl(path)} />}

        {error && <Aviso tono="error">{error}</Aviso>}

        <BorrarDosPasos
          texto={tr("Borrar este pago")}
          confirmar={tr("Toca otra vez para borrarlo de verdad")}
          cargando={borrando}
          onBorrar={onBorrar}
        />
      </div>
    </Hoja>
  );
}
