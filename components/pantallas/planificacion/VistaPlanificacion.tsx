"use client";

import { FileSpreadsheet, Plus } from "lucide-react";
import { localeActual, tr, trJsx, trN } from "@/lib/i18n";
import { fmtDate, fmtEUR } from "@/lib/format";
import { avanceObraExacto, estadoTarea, rangoObra } from "@/lib/gantt";
import { suma } from "@/lib/dinero";
import type { Tarea } from "@/lib/types";
import { FotoObra } from "@/components/marca/FotoObra";
import { Panel } from "@/components/ui/Panel";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Gantt } from "@/components/planificacion/Gantt";

export type PropsPlanificacion = {
  cargando: boolean;
  error: string;
  tareas: Tarea[];
  hoy: string;
  onAnadir: () => void;
  onImportar: () => void;
  onElegir: (t: Tarea) => void;
};

/**
 * Avance con dos decimales en el idioma activo. Se redondea ANTES de formatear
 * y se fijan los dos decimales: v1 pegaba una coma a mano y podía sacar
 * «,100» (DIS-02).
 */
const fmtAvance = (exacto: number) =>
  new Intl.NumberFormat(localeActual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(exacto * 100) / 100);

/**
 * Planificación (PLA-01…PLA-06): el edificio que crece con el avance real, la
 * cifra firma y, debajo, el Gantt entero en un panel de datos.
 */
export function VistaPlanificacion(p: PropsPlanificacion) {
  const exacto = avanceObraExacto(p.tareas);
  const rango = rangoObra(p.tareas);
  const hechas = p.tareas.filter((t) => t.avance >= 100).length;
  const retrasadas = p.tareas.filter((t) => estadoTarea(t, p.hoy) === "retrasada").length;
  // En céntimos (T-31); v1 sumaba decimales (DIS-03).
  const presupuestado = suma(p.tareas.map((t) => ({ importe: t.presupuesto })));

  return (
    <div className="grid gap-4">
      <header>
        <FotoObra className="-mx-4 h-64 md:mx-0 md:h-72 md:rounded-panel" />
        <h1 className="relative -mt-6 text-peq font-medium">{tr("Avance de la obra")}</h1>
        <p className="cifras text-gigante font-light tracking-[-0.04em]" data-testid="avance-obra">
          {fmtAvance(exacto)}%
        </p>
        <p className="mt-1 text-base" data-testid="avance-resumen">
          {p.tareas.length === 0
            ? tr("Todavía no hay plan")
            : tr("{hechas} de {total} tareas terminadas", { hechas, total: p.tareas.length }) +
              (retrasadas > 0 ? ` · ${tr("{n} con retraso", { n: retrasadas })}` : "")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
        <Boton ancho onClick={p.onAnadir} icono={<Plus size={18} aria-hidden />} data-testid="anadir-tarea">
          {tr("Añadir tarea")}
        </Boton>
        <Boton variante="secundario" ancho onClick={p.onImportar} icono={<FileSpreadsheet size={18} aria-hidden />} data-testid="desde-excel">
          {tr("Desde Excel")}
        </Boton>
      </div>

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      {p.cargando ? (
        <CargandoBloque alto="bloque" />
      ) : p.tareas.length === 0 ? (
        !p.error && (
          <Panel>
            <Vacio
              titulo={tr("Sin planificación todavía")}
              texto={tr("Añade las tareas de la obra con sus fechas y verás aquí el diagrama y el avance.")}
            />
          </Panel>
        )
      ) : (
        <Panel tono="honda">
          {rango && (
            <div className="mb-4 grid gap-1 text-peq text-sobre-honda-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0">
                  {trJsx("Del {desde} al {hasta}", {
                    desde: <strong className="font-semibold text-sobre-honda">{fmtDate(rango.desde)}</strong>,
                    hasta: <strong className="font-semibold text-sobre-honda">{fmtDate(rango.hasta)}</strong>,
                  })}
                </span>
                <span className="cifras font-medium text-sobre-honda">{trN(rango.dias, "{n} día", "{n} días")}</span>
              </div>
              {presupuestado > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="min-w-0">{tr("Presupuestado")}</span>
                  <span className="cifras whitespace-nowrap font-medium text-sobre-honda" data-testid="presupuestado">
                    {fmtEUR(presupuestado)}
                  </span>
                </div>
              )}
            </div>
          )}

          <Gantt tareas={p.tareas} hoy={p.hoy} onElegir={p.onElegir} />
        </Panel>
      )}
    </div>
  );
}
