"use client";

import { Lock, PenLine } from "lucide-react";
import { fmtEUR } from "@/lib/format";
import { detalleGasto, tituloGasto } from "@/lib/gastos";
import type { Gasto } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { BorrarDosPasos } from "@/components/ui/Controles";
import { VisorArchivo } from "@/components/ui/VisorArchivo";
import { PagadoPorBadge } from "@/components/ui/PagadoPor";

/** Detalle de un gasto (GAS-07): datos, archivo, Cambiar y Borrar (dos pasos). */
export function HojaDetalleGasto({
  gasto,
  puedeTocar,
  error,
  borrando,
  cargarUrl,
  onEditar,
  onBorrar,
  onCerrar,
}: {
  gasto: Gasto;
  /** Lo que pagó el dueño solo lo toca el dueño (también lo impide la base de datos). */
  puedeTocar: boolean;
  error: string;
  borrando: boolean;
  /** Pide la URL firmada del archivo del gasto. */
  cargarUrl: (path: string) => Promise<{ data: string | null; error: { message: string } | null }>;
  onEditar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const path = gasto.recibo_path;
  return (
    <Hoja titulo={tr("Gasto")} onCerrar={onCerrar}>
      <div className="grid gap-4 pt-1">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-40">
            <p className="break-words text-base font-semibold">{tituloGasto(gasto)}</p>
            <p className="mt-0.5 break-words text-peq text-tinta-2">{detalleGasto(gasto)}</p>
            <div className="mt-2">
              <PagadoPorBadge pagadoPor={gasto.pagado_por} />
            </div>
          </div>
          <p className="cifras whitespace-nowrap text-titulo font-medium" data-testid="detalle-importe">
            {fmtEUR(gasto.importe)}
          </p>
        </div>

        {path ? (
          <VisorArchivo clave={path} tipo={gasto.recibo_tipo} cargarUrl={() => cargarUrl(path)} />
        ) : (
          <p className="rounded-[10px] bg-fondo/60 px-3.5 py-3 text-peq text-tinta-2">{tr("Sin foto ni PDF.")}</p>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}

        {!puedeTocar ? (
          <p className="flex items-start justify-center gap-2 rounded-[10px] bg-fondo/60 px-3.5 py-3 text-center text-peq">
            <Lock size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{tr("Lo pagó el dueño: solo él puede cambiarlo.")}</span>
          </p>
        ) : (
          <div className="grid gap-2">
            <Boton grande ancho icono={<PenLine size={18} aria-hidden />} onClick={onEditar} data-testid="cambiar-gasto">
              {tr("Cambiar")}
            </Boton>
            <BorrarDosPasos
              texto={tr("Borrar este gasto")}
              confirmar={tr("Toca otra vez para borrarlo de verdad")}
              cargando={borrando}
              onBorrar={onBorrar}
            />
          </div>
        )}
      </div>
    </Hoja>
  );
}
