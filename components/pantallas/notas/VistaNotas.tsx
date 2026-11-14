"use client";

import { Mic } from "lucide-react";
import { tr } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { NotaAudio } from "@/lib/types";
import { Panel } from "@/components/ui/Panel";
import { NavDia } from "@/components/ui/Navegacion";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { Cargando, CargandoBloque } from "@/components/ui/Cargando";
import { BorrarDosPasos } from "@/components/ui/Controles";
import { GrabadorAudio, fmtDuracion } from "@/components/ui/GrabadorAudio";

export type PropsVistaNotas = {
  cargando: boolean;
  /** Error de lectura (la nota del día o la lista). */
  errorCarga: string;
  /** Error de escritura (subir, guardar, borrar). */
  error: string;
  fecha: string;
  nota: NotaAudio | null;
  /** URL firmada (1 h) del audio de la nota; null mientras llega. */
  urlAudio: string | null;
  subiendo: boolean;
  ultimas: NotaAudio[];
  onFecha: (f: string) => void;
  onEmpezar: () => void;
  onGrabado: (blob: Blob, extension: string, segundos: number) => void;
  onBorrar: () => void;
};

/**
 * Vista de notas de voz (NOT-01…NOT-04): una nota por obra y día. El
 * grabador es el protagonista; el reproductor va en un panel hondo.
 */
export function VistaNotas(p: PropsVistaNotas) {
  return (
    <div className="grid gap-4">
      <h1 className="sr-only">{tr("Notas de voz")}</h1>
      <NavDia fecha={p.fecha} onCambio={p.onFecha} />

      {p.errorCarga && <Aviso tono="error">{p.errorCarga}</Aviso>}

      {p.cargando ? (
        <CargandoBloque alto="bloque" />
      ) : p.nota ? (
        <>
          <Panel tono="honda" data-testid="nota-del-dia">
            <div className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h2 className="min-w-0 text-titulo font-medium tracking-[-0.01em]">{tr("Nota de este día")}</h2>
              {p.nota.duracion_seg != null && (
                <span className="cifras text-base font-medium">{fmtDuracion(p.nota.duracion_seg)}</span>
              )}
            </div>
            {p.urlAudio ? (
              <audio controls src={p.urlAudio} className="w-full" />
            ) : (
              <p className="py-2 text-base text-sobre-honda-2">{tr("Cargando audio…")}</p>
            )}
          </Panel>

          <div className="grid gap-3">
            <GrabadorAudio onGrabado={p.onGrabado} onEmpezar={p.onEmpezar} disabled={p.subiendo} />
            <BorrarDosPasos key={p.nota.id} texto={tr("Eliminar nota")} confirmar={tr("Confirmar borrado")} onBorrar={p.onBorrar} />
            <p className="text-center text-peq">{tr("Si grabas otra vez, sustituye a esta nota")}</p>
          </div>
        </>
      ) : (
        <div className="grid gap-3">
          <p className="text-center text-base">
            {tr("Sin nota de voz el {fecha}. Cuenta qué se ha hecho hoy en la obra.", { fecha: fmtDate(p.fecha) })}
          </p>
          <GrabadorAudio onGrabado={p.onGrabado} onEmpezar={p.onEmpezar} disabled={p.subiendo} />
        </div>
      )}

      {p.subiendo && (
        <p className="flex items-center justify-center gap-2 text-base">
          <Cargando tamano="peq" /> {tr("Guardando…")}
        </p>
      )}
      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      <section className="grid gap-2">
        <h2 className="text-titulo font-medium tracking-[-0.01em]">{tr("Últimas notas")}</h2>
        {p.ultimas.length === 0 ? (
          <Panel>
            <Vacio titulo={tr("Todavía no hay notas de voz")} texto={tr("Las que grabes aparecerán aquí.")} />
          </Panel>
        ) : (
          <ul className="grid gap-2">
            {p.ultimas.map((n) => {
              const actual = n.fecha === p.fecha;
              return (
                <li key={n.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => p.onFecha(n.fecha)}
                    aria-current={actual ? "date" : undefined}
                    data-testid="nota-reciente"
                    className={
                      actual
                        ? "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-panel bg-negro px-4 py-2 text-left text-sobre-negro"
                        : "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-panel bg-sup px-4 py-2 text-left text-tinta"
                    }
                  >
                    <Mic size={18} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 break-words text-base font-semibold">{fmtDate(n.fecha)}</span>
                    {n.duracion_seg != null && <span className="cifras shrink-0 text-base">{fmtDuracion(n.duracion_seg)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
