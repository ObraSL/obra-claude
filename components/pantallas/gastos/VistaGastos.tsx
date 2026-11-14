"use client";

import { Camera, Plus } from "lucide-react";
import { fmtEUR, monthLabel } from "@/lib/format";
import { pagadoPorMi, suma } from "@/lib/dinero";
import { detalleGasto, tituloGasto } from "@/lib/gastos";
import type { Gasto, PagadoPor } from "@/lib/types";
import { tr, trN } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Segmentos } from "@/components/ui/Controles";
import { FiltroMes } from "@/components/ui/Navegacion";
import { PagadoPorBadge } from "@/components/ui/PagadoPor";

export type Quien = "todo" | PagadoPor;

export type PropsGastos = {
  cargando: boolean;
  /** Error de lectura o de borrado: se enseña sin perder lo que ya había. */
  error: string;
  /** Todos los gastos de la obra; los filtros se aplican aquí (GAS-02/03). */
  gastos: Gasto[];
  quien: Quien;
  mes: string | null;
  onQuien: (q: Quien) => void;
  onMes: (m: string | null) => void;
  onAnadir: () => void;
  onAbrir: (g: Gasto) => void;
};

/**
 * Pantalla de gastos (GAS-02…GAS-04): tickets y facturas en una sola lista.
 * El filtro «quién lo pagó» + mes responde a «qué pagué yo en esta obra en
 * octubre», de dos toques.
 */
export function VistaGastos(p: PropsGastos) {
  const filtrados = p.gastos.filter(
    (g) => (p.quien === "todo" || g.pagado_por === p.quien) && (!p.mes || g.fecha.slice(0, 7) === p.mes)
  );
  const total = suma(filtrados);
  const mio = pagadoPorMi(filtrados);

  const titulo =
    p.quien === "personal" ? tr("Pagado por ti") : p.quien === "empresa" ? tr("Pagado por la empresa") : tr("Total gastado");

  return (
    <div className="grid gap-4">
      <Panel tono="honda" aria-busy={p.cargando || undefined} data-testid="resumen-gastos">
        <h1 className="text-peq font-medium">
          {titulo}
          {p.mes && <span> · {monthLabel(p.mes)}</span>}
        </h1>
        <p className="cifras mt-1 break-words text-cifra font-light tracking-[-0.03em]" data-testid="gastos-total">
          {fmtEUR(total)}
        </p>
        <p className="mt-1 text-base" data-testid="gastos-cuenta">
          {trN(filtrados.length, "{n} gasto", "{n} gastos")}
        </p>
        {p.quien === "todo" && mio > 0 && (
          <div className="mt-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-[10px] bg-white/10 px-3.5 py-2.5">
            <span className="min-w-0 text-peq text-sobre-honda-2">{tr("De eso, pagado por ti")}</span>
            <span className="cifras whitespace-nowrap text-base font-semibold" data-testid="gastos-mio">
              {fmtEUR(mio)}
            </span>
          </div>
        )}
      </Panel>

      <Boton grande ancho icono={<Plus size={20} aria-hidden />} onClick={p.onAnadir} data-testid="anadir-gasto">
        {tr("Añadir gasto o factura")}
      </Boton>

      <Segmentos<Quien>
        etiqueta={tr("¿Quién lo pagó?")}
        valor={p.quien}
        onCambio={p.onQuien}
        opciones={[
          { valor: "todo", texto: tr("Todo") },
          { valor: "personal", texto: tr("Pagué yo") },
          { valor: "empresa", texto: tr("La empresa") },
        ]}
      />

      <FiltroMes mes={p.mes} onCambio={p.onMes} onQuitar={() => p.onMes(null)} />

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      <Panel tono="honda" relleno="ninguno" aria-busy={p.cargando || undefined}>
        {p.cargando ? (
          <CargandoBloque alto="bloque" />
        ) : filtrados.length === 0 ? (
          <Vacio
            sobre="honda"
            titulo={p.gastos.length === 0 ? tr("Sin gastos todavía") : tr("Nada con ese filtro")}
            texto={
              p.gastos.length === 0 ? tr("Tickets y facturas de esta obra aparecerán aquí.") : tr("Prueba con otro mes o con «Todo».")
            }
          />
        ) : (
          <ul className="grid gap-1.5 p-2" data-testid="lista-gastos">
            {filtrados.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => p.onAbrir(g)}
                  className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] bg-white/10 px-3.5 py-2.5 text-left transition-colors hover:bg-white/15"
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
                    <span className="mt-0.5 block break-words text-peq text-sobre-honda-2">{detalleGasto(g)}</span>
                    {g.pagado_por === "personal" && (
                      <span className="mt-1.5 block">
                        <PagadoPorBadge pagadoPor={g.pagado_por} />
                      </span>
                    )}
                  </span>
                  <span className="cifras shrink-0 whitespace-nowrap text-base font-semibold">{fmtEUR(g.importe)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
