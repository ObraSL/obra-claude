"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { Banknote, FileText, Plus, Wallet } from "lucide-react";
import { fmtDate, fmtEUR } from "@/lib/format";
import type { Cobro, Entrega } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { Varillas } from "@/components/marca/Varillas";
import { Panel } from "@/components/ui/Panel";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { CargandoBloque } from "@/components/ui/Cargando";
import { BorrarDosPasos, Segmentos } from "@/components/ui/Controles";
import { varillasPresupuesto } from "@/components/pantallas/inicio/VistaInicioGestor";

export type PropsDinero = {
  cargando: boolean;
  /** Error de lectura o de borrado: se enseña sin perder lo que ya había. */
  error: string;
  obraNombre: string;
  obras: { id: string; nombre: string }[];
  /** Caja del jefe: solo el dueño y solo con el módulo `caja_jefe` encendido. */
  conCaja: boolean;
  cobrado: number;
  gastado: number;
  /** Dinero del jefe apuntado a esta obra (solo dueño; ya sumado en `balance`, Q-01). */
  recibidoObra: number;
  balance: number;
  presupuesto: number;
  pctPresupuesto: number;
  caja: { recibido: number; pagado: number; queda: number };
  cobros: Cobro[];
  entregas: Entrega[];
  /** Lo pagado por el dueño, obra por obra (ya ordenado de más a menos). */
  pagadoPorObra: { nombre: string; total: number }[];
  /** Id de la entrega que se está borrando. */
  borrandoEntrega: string | null;
  onAnadirCobro: () => void;
  onAbrirCobro: (c: Cobro) => void;
  onAnadirEntrega: () => void;
  onBorrarEntrega: (e: Entrega) => void;
};

/** Pantalla del jefe de obra: no ve el dinero (DIN-01). */
export function VistaDineroBloqueada() {
  return (
    <Panel tono="honda" data-testid="dinero-bloqueado">
      <h1 className="sr-only">{tr("Dinero")}</h1>
      <Vacio
        sobre="honda"
        titulo={tr("Solo para el dueño y el manager")}
        texto={tr("Aquí se ve lo que paga el cliente y lo que queda en la obra.")}
      />
    </Panel>
  );
}

/** Una línea «texto … importe» dentro de un panel hondo. */
function Linea({ texto, valor, testid }: { texto: string; valor: number; testid?: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-[10px] bg-white/10 px-3.5 py-2.5">
      <dt className="min-w-0 text-peq text-sobre-honda-2">{texto}</dt>
      <dd className="cifras whitespace-nowrap text-base font-semibold" data-testid={testid}>
        {fmtEUR(valor)}
      </dd>
    </div>
  );
}

/** La cifra grande de un panel: en negativo va en un relleno coral (la frase dice el significado). */
function CifraGrande({ children, negativa, testid }: { children: ReactNode; negativa: boolean; testid?: string }) {
  return (
    <p
      className={clsx(
        "cifras mt-2 inline-block max-w-full break-words text-cifra font-light tracking-[-0.03em]",
        negativa && "rounded-[6px] bg-coral px-2 py-1 text-sobre-coral"
      )}
      data-testid={testid}
    >
      {children}
    </p>
  );
}

/**
 * Dinero (DIN-01…DIN-05): dos cuentas que no hay que mezclar. LA OBRA = lo
 * que ha pagado el cliente − todo lo gastado en ella. MI CAJA (solo el
 * dueño) = lo que le ha dado el jefe − lo que ha pagado él de su mano.
 */
export function VistaDinero(p: PropsDinero) {
  const [pestana, setPestana] = useState<"cliente" | "jefe">("cliente");
  const verJefe = p.conCaja && pestana === "jefe";
  const positivo = p.balance >= 0;
  const nombreObra = (id: string | null) => p.obras.find((o) => o.id === id)?.nombre;

  if (p.cargando) {
    return (
      <Panel tono="honda" aria-busy>
        <h1 className="text-peq font-medium">
          {tr("Esta obra ·")} <span className="break-words">{p.obraNombre}</span>
        </h1>
        <CargandoBloque alto="bloque" />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      {/* ----- La obra ----- */}
      <Panel tono="honda" data-testid="dinero-obra">
        <h1 className="text-peq font-medium">
          {tr("Esta obra ·")} <span className="break-words">{p.obraNombre}</span>
        </h1>
        <p className="mt-3 text-base">{positivo ? tr("La obra va en positivo") : tr("La obra va en negativo")}</p>
        <CifraGrande negativa={!positivo} testid="balance-obra">
          {positivo ? "+" : "−"}
          {fmtEUR(Math.abs(p.balance))}
        </CifraGrande>

        <dl className="mt-4 grid gap-2">
          <Linea texto={tr("Cobrado del cliente")} valor={p.cobrado} testid="dinero-cobrado" />
          {p.conCaja && p.recibidoObra > 0 && (
            <Linea texto={tr("Recibido del jefe (esta obra)")} valor={p.recibidoObra} testid="dinero-recibido-obra" />
          )}
          <Linea texto={tr("Gastado")} valor={p.gastado} testid="dinero-gastado" />
        </dl>

        {p.presupuesto > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-peq">
              <span className="min-w-0">{tr("Presupuesto del plan · {importe}", { importe: fmtEUR(p.presupuesto) })}</span>
              <strong className={clsx("cifras font-semibold", p.pctPresupuesto > 100 && "rounded-[5px] bg-coral px-1.5 text-sobre-coral")}>
                {tr("{pct}% gastado", { pct: p.pctPresupuesto })}
              </strong>
            </div>
            <Varillas
              varillas={varillasPresupuesto(p.pctPresupuesto)}
              alto={28}
              grosor={0.5}
              resumen={`${tr("Presupuesto del plan · {importe}", { importe: fmtEUR(p.presupuesto) })}: ${tr("{pct}% gastado", { pct: p.pctPresupuesto })}`}
            />
          </div>
        )}
      </Panel>

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      {/* ----- Mi caja (solo el dueño) ----- */}
      {p.conCaja && (
        <Panel tono="honda" data-testid="dinero-caja">
          <h2 className="text-peq font-medium">
            {tr("Mi caja ·")} <span>{tr("todas las obras")}</span>
          </h2>
          <p className="mt-3 text-base">{p.caja.queda >= 0 ? tr("Me quedan para gastos") : tr("La empresa me debe")}</p>
          <CifraGrande negativa={p.caja.queda < 0} testid="caja-queda">
            {fmtEUR(Math.abs(p.caja.queda))}
          </CifraGrande>
          <dl className="mt-4 grid gap-2">
            <Linea texto={tr("Me ha dado el jefe")} valor={p.caja.recibido} />
            <Linea texto={tr("He pagado yo")} valor={p.caja.pagado} />
          </dl>
        </Panel>
      )}

      {/* ----- Pestañas ----- */}
      {p.conCaja && (
        <Segmentos<"cliente" | "jefe">
          etiqueta={tr("Dinero")}
          valor={pestana}
          onCambio={setPestana}
          opciones={[
            {
              valor: "cliente",
              texto: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Banknote size={16} aria-hidden className="shrink-0" /> {tr("Del cliente")}
                </span>
              ),
            },
            {
              valor: "jefe",
              texto: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Wallet size={16} aria-hidden className="shrink-0" /> {tr("Del jefe")}
                </span>
              ),
            },
          ]}
        />
      )}

      {!verJefe && (
        <>
          <Boton grande ancho icono={<Plus size={20} aria-hidden />} onClick={p.onAnadirCobro} data-testid="anadir-cobro">
            {tr("Añadir lo que ha pagado el cliente")}
          </Boton>
          <Panel tono="honda" relleno="ninguno">
            {p.cobros.length === 0 ? (
              <Vacio
                sobre="honda"
                titulo={tr("Sin cobros en esta obra")}
                texto={tr("Apunta aquí cada pago del cliente para ver cómo va la obra.")}
              />
            ) : (
              <ul className="grid gap-1.5 p-2" data-testid="lista-cobros">
                {p.cobros.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => p.onAbrirCobro(c)}
                      className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] bg-white/10 px-3.5 py-2.5 text-left transition-colors hover:bg-white/15"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-start gap-1.5">
                          <span className="min-w-0 break-words text-base font-semibold">{c.concepto || tr("Pago del cliente")}</span>
                          {c.archivo_path && (
                            <span role="img" aria-label={tr("Con foto o PDF")} className="mt-0.5 shrink-0">
                              <FileText size={16} aria-hidden />
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-peq text-sobre-honda-2">{fmtDate(c.fecha)}</span>
                      </span>
                      <span className="cifras shrink-0 whitespace-nowrap text-base font-semibold">+{fmtEUR(c.importe)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {verJefe && (
        <>
          <Boton grande ancho icono={<Plus size={20} aria-hidden />} onClick={p.onAnadirEntrega} data-testid="anadir-entrega">
            {tr("Añadir dinero que me dio el jefe")}
          </Boton>
          <Panel tono="honda" relleno="ninguno">
            {p.entregas.length === 0 ? (
              <Vacio
                sobre="honda"
                titulo={tr("Sin entregas apuntadas")}
                texto={tr("Cada vez que el jefe te dé dinero para gastos o sueldos, apúntalo aquí.")}
              />
            ) : (
              <ul className="grid gap-1.5 p-2" data-testid="lista-entregas">
                {p.entregas.map((e) => {
                  const obra = nombreObra(e.obra_id);
                  return (
                    <li key={e.id} className="grid gap-2 rounded-[10px] bg-white/10 px-3.5 py-2.5">
                      <div className="flex min-h-9 min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-base font-semibold">{e.concepto || tr("Dinero para gastos")}</p>
                          <p className="mt-0.5 break-words text-peq text-sobre-honda-2">
                            {fmtDate(e.fecha)}
                            {obra ? ` · ${obra}` : ""}
                          </p>
                        </div>
                        <p className="cifras shrink-0 whitespace-nowrap text-base font-semibold">{fmtEUR(e.importe)}</p>
                      </div>
                      <BorrarDosPasos
                        texto={tr("Borrar")}
                        confirmar={tr("Borrar")}
                        cargando={p.borrandoEntrega === e.id}
                        onBorrar={() => p.onBorrarEntrega(e)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {p.pagadoPorObra.length > 0 && (
            <Panel tono="honda">
              <h2 className="text-titulo font-medium">{tr("Lo que he pagado yo, por obra")}</h2>
              <ul className="mt-3 grid gap-1.5" data-testid="pagado-por-obra">
                {p.pagadoPorObra.map((o) => (
                  <li
                    key={o.nombre}
                    className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-[10px] bg-white/10 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 break-words text-peq text-sobre-honda-2">{o.nombre}</span>
                    <span className="cifras shrink-0 whitespace-nowrap text-base font-semibold">{fmtEUR(o.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-peq text-sobre-honda-2">{tr("Para ver cada ticket: en «Gastos» de esa obra, toca «Pagué yo».")}</p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
