"use client";

import clsx from "clsx";
import Link from "next/link";
import { ViewTransition } from "react";
import { ArrowUpRight, ChevronRight, Clock3, MapPin, TriangleAlert, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { tr, trJsx, trN } from "@/lib/i18n";
import { TIPO_ADELANTE } from "@/lib/nav";
import { fmtDate, fmtEUR, fmtEURCorto } from "@/lib/format";
import { posicionDia, rangoObra } from "@/lib/gantt";
import type { Tarea } from "@/lib/types";
import { FotoObra } from "@/components/marca/FotoObra";
import { CifraAvance } from "@/components/marca/CifraAvance";
import { Medidor } from "@/components/marca/Medidor";
import { Varillas, type Varilla } from "@/components/marca/Varillas";
import { MiniGantt } from "@/components/planificacion/MiniGantt";
import { Panel } from "@/components/ui/Panel";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Aviso } from "@/components/ui/Aviso";
import { CargandoBloque } from "@/components/ui/Cargando";

export type PropsInicioGestor = {
  cargando: boolean;
  error: string;
  obraNombre: string;
  obraDireccion: string | null;
  /** Dueño y manager ven lo que paga el cliente y el balance; el jefe de obra no (HOM-05). */
  veDinero: boolean;
  moduloVehiculos: boolean;
  hoy: string;
  tareas: Tarea[];
  /** Avance ponderado por días, con decimales (HOM-02). */
  avance: number;
  finPrevisto: string | null;
  retrasadas: number;
  /** Minutos trabajados en la obra cada uno de los últimos 14 días (el último es hoy). */
  horasDia: number[];
  /** Minutos del mes entero en la obra (HOM-03). */
  horasMes: number;
  fichadosHoy: number | null;
  cochesHoy: number | null;
  cobrado: number;
  gastado: number;
  balance: number;
  gastadoMes: number;
  pagadoPorMiMes: number;
  presupuesto: number;
  pctPresupuesto: number;
  accesos: { href: string; label: string; icon: LucideIcon }[];
};

/** Regla del presupuesto en 40 varillas: blancas = gastado, lima = queda, coral = lo que se pasa (momento firma nº 3). */
export function varillasPresupuesto(pct: number): Varilla[] {
  const N = 40;
  if (pct <= 100) {
    const gastadas = Math.round((pct / 100) * N);
    return Array.from({ length: N }, (_, i) => ({ alto: 1, tono: i < gastadas ? "blanco" : "lima" }));
  }
  // Pasado de presupuesto: la regla entera representa lo gastado; el tramo final, en coral, es el exceso.
  const dentro = Math.max(1, Math.round((100 / pct) * N));
  return Array.from({ length: N }, (_, i) => ({ alto: 1, tono: i < dentro ? "blanco" : "coral" }));
}

/** Inicio del gestor (HOM-01…HOM-07): el edificio que crece, las horas en varillas y el dinero de la obra. */
export function VistaInicioGestor(p: PropsInicioGestor) {
  const maxHoras = Math.max(1, ...p.horasDia);
  const hayHoras = p.horasDia.some((h) => h > 0);
  const horas: Varilla[] = p.horasDia.map((min, i) => ({
    alto: min > 0 ? Math.max(0.12, min / maxHoras) : 0.04,
    tono: min === 0 ? "apagado" : i === p.horasDia.length - 1 ? "lima" : "blanco",
  }));
  const signo = p.balance > 0 ? "+" : p.balance < 0 ? "−" : "";
  // Cuánto del calendario del plan ha pasado (el mismo «hoy» que la línea del Gantt):
  // antes de empezar 0 %, después de acabar 100 %. Sin plan no hay medidor.
  const rango = rangoObra(p.tareas);
  const tiempo = rango ? (p.hoy < rango.desde ? 0 : p.hoy > rango.hasta ? 100 : Math.round(posicionDia(p.hoy, rango) ?? 0)) : null;
  const avanceEntero = Math.round(p.avance);
  const conMedidor = p.cargando || tiempo !== null;

  return (
    <div className="grid gap-4">
      <header className="min-w-0">
        <h1 className="break-words text-h1 font-medium tracking-[-0.02em]">{p.obraNombre}</h1>
        {p.obraDireccion && (
          <p className="mt-0.5 flex items-start gap-1.5 text-base">
            <MapPin size={16} aria-hidden className="mt-1 shrink-0" />
            <span className="min-w-0 break-words">{p.obraDireccion}</span>
          </p>
        )}
      </header>

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      {/* Portada: la obra creciendo con su avance real, y debajo, pegado, el panel de datos. */}
      <section aria-label={tr("Avance de la obra")}>
        <div className="relative">
          {/* Como el «On Track» de la referencia: con retraso, coral y su número; sin retrasos (y con plan), cristal. */}
          {p.retrasadas > 0 ? (
            <Etiqueta tono="coral" className="absolute right-0 top-3 z-10">
              {tr("{n} con retraso", { n: p.retrasadas })}
            </Etiqueta>
          ) : (
            !p.cargando &&
            p.tareas.length > 0 && (
              <Etiqueta tono="vidrio" className="absolute right-0 top-3 z-10">
                {tr("En plazo")}
              </Etiqueta>
            )
          )}
          <FotoObra prioritaria className="-mx-4 h-80 md:mx-0 md:h-96 md:rounded-panel" />
        </div>

        <Panel tono="honda" vidrio className="relative -mt-20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-peq">{tr("Avance de la obra")}</h2>
              <ViewTransition name="cifra-avance" share="morph" default="none">
                <CifraAvance valor={p.avance} className="mt-2" />
              </ViewTransition>
            </div>
            <Link
              href="/planificacion"
              transitionTypes={TIPO_ADELANTE}
              aria-label={tr("Ver la planificación")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-lima text-sobre-lima active:scale-95"
            >
              <ArrowUpRight size={20} aria-hidden />
            </Link>
          </div>

          {/* Sin plan el número sería un 0 sin explicación: mejor decir por qué. */}
          {!p.cargando && p.tareas.length === 0 && (
            <Link href="/planificacion" transitionTypes={TIPO_ADELANTE} className="mt-2 inline-flex min-h-11 items-center text-base font-medium underline underline-offset-4">
              {tr("Todavía no hay plan — añádelo o tráelo del Excel")}
            </Link>
          )}

          {/* Con la obra recién abierta no hay ni una hora fichada y el gráfico
              salía como una raya plana, que parece un fallo. */}
          <div className="mt-5">
            {p.cargando ? (
              <CargandoBloque alto="bloque" />
            ) : hayHoras ? (
              <Varillas
                varillas={horas}
                alto={72}
                grosor={0.5}
                resumen={`${tr("Últimas 2 semanas")}: ${tr("Horas fichadas")}`}
              />
            ) : (
              <p className="flex h-[72px] items-center justify-center rounded-[10px] bg-white/10 px-3 text-center text-peq">
                {tr("Sin horas fichadas estas dos semanas")}
              </p>
            )}
          </div>

          <dl className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <dt className="text-peq text-sobre-honda-2">{p.finPrevisto ? tr("Fin previsto") : tr("Últimas 2 semanas")}</dt>
              <dd className="cifras text-base font-medium">{p.finPrevisto ? fmtDate(p.finPrevisto) : tr("Horas fichadas")}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-peq text-sobre-honda-2">{tr("Horas del mes")}</dt>
              <dd className="cifras text-base font-medium" data-testid="horas-mes-obra">
                {Math.round(p.horasMes / 60)} h
              </dd>
            </div>
          </dl>
        </Panel>
      </section>

      {/* Como las tarjetas de la referencia: el medidor (avance contra calendario) y, al lado,
          cuánta gente ha fichado hoy y cuántas tareas van con retraso. Cada tarjeta es
          un atajo a la pantalla donde se arregla. */}
      <section aria-label={tr("Avance de la obra")} className="grid grid-cols-2 gap-3">
        {conMedidor && (
          <Panel tono="honda" como="div" relleno="compacto" className="flex flex-col justify-center">
            {tiempo !== null ? (
              <>
                <Medidor
                  avance={p.avance}
                  tiempo={tiempo}
                  titulo={`${tr("Avance de la obra")}: ${avanceEntero} % · ${tr("Tiempo transcurrido")}: ${tiempo} %`}
                  className="mx-auto max-w-[10rem]"
                />
                {/* Leyenda: punto lima = el arco (avance); raya blanca = la aguja (tiempo). */}
                <ul className="cifras mt-1 grid justify-center gap-0.5 text-peq">
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-lima" />
                    {tr("Avance {a} %", { a: avanceEntero })}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden className="h-0.5 w-2.5 shrink-0 rounded-full bg-white" />
                    {tr("Tiempo {t} %", { t: tiempo })}
                  </li>
                </ul>
              </>
            ) : (
              <CargandoBloque alto="bloque" />
            )}
          </Panel>
        )}
        <div className={clsx("grid min-w-0 gap-3", !conMedidor && "col-span-2 grid-cols-2")}>
          <TarjetaDato
            href="/fichajes"
            etiqueta={tr("Fichados hoy")}
            valor={p.fichadosHoy != null ? String(p.fichadosHoy) : "—"}
            icono={Clock3}
          />
          <TarjetaDato
            href="/planificacion"
            etiqueta={tr("Tareas con retraso")}
            valor={p.tareas.length > 0 || !p.cargando ? String(p.retrasadas) : "—"}
            icono={TriangleAlert}
            alerta={p.retrasadas > 0}
          />
        </div>
      </section>

      {/* El plan en miniatura: de un toque se abre el Gantt completo (en el
          móvil, Planificación se alcanza desde aquí: SHL-02). */}
      {p.tareas.length > 0 && p.finPrevisto && (
        <Link href="/planificacion" transitionTypes={TIPO_ADELANTE} className="block rounded-panel">
          <Panel tono="honda" como="div">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-titulo font-medium">{tr("Planificación")}</h2>
              <ChevronRight size={20} aria-hidden className="shrink-0" />
            </div>
            <p className="mb-3.5 mt-1 text-peq text-sobre-honda-2">
              {trN(p.tareas.length, "{n} capítulo", "{n} capítulos")} · {tr("hasta {fecha}", { fecha: fmtDate(p.finPrevisto) })}
              {p.retrasadas > 0 && (
                <>
                  {" · "}
                  <strong className="rounded-[5px] bg-coral px-1.5 font-semibold text-sobre-coral">{tr("{n} con retraso", { n: p.retrasadas })}</strong>
                </>
              )}
            </p>
            <MiniGantt tareas={p.tareas} hoy={p.hoy} />
          </Panel>
        </Link>
      )}

      {/* El dinero de la obra entera (no solo del mes): cuánto ha pagado el
          cliente, cuánto se ha gastado —tickets y facturas juntos— y cómo va. */}
      <Link href={p.veDinero ? "/dinero" : "/gastos"} className="block rounded-panel">
        <Panel tono="honda" como="div">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-titulo font-medium">{tr("Dinero de la obra")}</h2>
            <ChevronRight size={20} aria-hidden className="shrink-0" />
          </div>

          {p.veDinero ? (
            <>
              <p className="mt-3 text-peq text-sobre-honda-2">{tr("Balance")}</p>
              <p
                className={clsx(
                  "cifras mt-1 inline-block max-w-full break-words text-cifra font-light tracking-[-0.03em]",
                  p.balance < 0 && "rounded-[6px] bg-coral px-2 py-1 text-sobre-coral"
                )}
                data-testid="balance-obra"
              >
                {signo}
                {fmtEURCorto(Math.abs(p.balance))}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="min-w-0 rounded-[10px] bg-white/10 px-3 py-2.5">
                  <dt className="text-peq text-sobre-honda-2">{tr("Cobrado")}</dt>
                  <dd className="cifras break-words text-titulo">{fmtEURCorto(p.cobrado)}</dd>
                </div>
                <div className="min-w-0 rounded-[10px] bg-white/10 px-3 py-2.5">
                  <dt className="text-peq text-sobre-honda-2">{tr("Gastado")}</dt>
                  <dd className="cifras break-words text-titulo">{fmtEURCorto(p.gastado)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p className="mt-3 text-peq text-sobre-honda-2">{tr("Gastado en total")}</p>
              <p className="cifras mt-1 break-words text-cifra font-light tracking-[-0.03em]">{fmtEUR(p.gastado)}</p>
            </>
          )}

          <p className="mt-3 text-peq">
            {trJsx("Este mes: {importe}", { importe: <strong className="cifras font-semibold">{fmtEUR(p.gastadoMes)}</strong> })}
            {p.pagadoPorMiMes > 0 && (
              <>
                {" · "}
                {trJsx("pagado por ti {importe}", {
                  importe: <strong className="cifras font-semibold text-lima">{fmtEUR(p.pagadoPorMiMes)}</strong>,
                })}
              </>
            )}
          </p>

          {p.presupuesto > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-peq">
                <span>{tr("Presupuesto {importe}", { importe: fmtEURCorto(p.presupuesto) })}</span>
                <strong className={clsx("cifras font-semibold", p.pctPresupuesto > 100 && "rounded-[5px] bg-coral px-1.5 text-sobre-coral")}>
                  {tr("{pct}% gastado", { pct: p.pctPresupuesto })}
                </strong>
              </div>
              <Varillas
                varillas={varillasPresupuesto(p.pctPresupuesto)}
                alto={28}
                grosor={0.5}
                resumen={`${tr("Presupuesto {importe}", { importe: fmtEURCorto(p.presupuesto) })}: ${tr("{pct}% gastado", { pct: p.pctPresupuesto })}`}
              />
            </div>
          )}
        </Panel>
      </Link>

      {/* «Fichados hoy» subió a las tarjetas de arriba; aquí queda lo que no tiene sitio allí. */}
      {p.moduloVehiculos && (
        <Dato etiqueta={tr("Coches hoy")} valor={p.cochesHoy != null ? String(p.cochesHoy) : "—"} icono={Truck} />
      )}

      <nav aria-label={tr("Accesos rápidos")} className="grid grid-cols-2 gap-3">
        {p.accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex min-h-14 min-w-0 items-center gap-2.5 rounded-panel bg-sup px-3.5 py-3 text-base font-medium hover:brightness-110"
          >
            <a.icon size={20} aria-hidden strokeWidth={1.8} className="shrink-0" />
            <span className="min-w-0 flex-1 break-words">{tr(a.label)}</span>
            <ChevronRight size={18} aria-hidden className="shrink-0 opacity-80" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Tarjeta de dato que es atajo a otra pantalla; en coral si hay algo que atender. */
function TarjetaDato({
  href,
  etiqueta,
  valor,
  icono: Icono,
  alerta = false,
}: {
  href: string;
  etiqueta: string;
  valor: string;
  icono: LucideIcon;
  alerta?: boolean;
}) {
  return (
    <Link href={href} transitionTypes={TIPO_ADELANTE} className="block min-w-0 rounded-panel active:scale-[0.985]">
      <Panel tono="honda" como="div" relleno="compacto" className="h-full">
        <p className="flex items-center gap-1.5 text-peq">
          <Icono size={16} aria-hidden strokeWidth={1.8} className="shrink-0" />
          <span className="min-w-0 break-words">{etiqueta}</span>
        </p>
        <p
          className={clsx(
            "cifras mt-1 inline-block text-cifra font-light tracking-[-0.03em]",
            alerta && "rounded-[6px] bg-coral px-2 text-sobre-coral"
          )}
        >
          {valor}
        </p>
      </Panel>
    </Link>
  );
}

/** Un dato suelto del día (Coches hoy). */
export function Dato({ etiqueta, valor, icono: Icono }: { etiqueta: string; valor: string; icono: LucideIcon }) {
  return (
    <Panel relleno="compacto" como="div" className="min-w-0">
      <p className="flex items-center gap-1.5 text-peq">
        <Icono size={16} aria-hidden strokeWidth={1.8} className="shrink-0" />
        <span className="min-w-0 break-words">{etiqueta}</span>
      </p>
      <p className="cifras mt-1 text-cifra font-light tracking-[-0.03em]">{valor}</p>
    </Panel>
  );
}
