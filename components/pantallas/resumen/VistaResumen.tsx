"use client";

import clsx from "clsx";
import {
  Banknote,
  ChevronRight,
  Download,
  Fuel,
  MoreHorizontal,
  Package,
  ReceiptText,
  Trash2,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { tr, trN } from "@/lib/i18n";
import { fmtDate, fmtEUR } from "@/lib/format";
import { fmtHoras } from "@/lib/horas";
import { Panel } from "@/components/ui/Panel";
import { NavMes } from "@/components/ui/Navegacion";
import { Segmentos } from "@/components/ui/Controles";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Vacio } from "@/components/ui/Vacio";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { CargandoBloque } from "@/components/ui/Cargando";

export type SeccionResumen = "trabajadores" | "vehiculos" | "gastos";

export type FilaTrabajadorMes = { id: string; nombre: string; dias: number; trabajados: number; extra: number; sinCerrar: number };
export type FilaVehiculoMes = { id: string; nombre: string; dias: number };
export type FilaCategoriaMes = { categoria: string; total: number; n: number; desde: string; hasta: string; pct: number };

const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  Material: Package,
  "Maquinaria / alquiler": Wrench,
  Combustible: Fuel,
  "Mano de obra externa": Users,
  Sueldos: Banknote,
  "Gestión de residuos": Trash2,
  Otros: MoreHorizontal,
};

export type PropsResumen = {
  mes: string;
  seccion: SeccionResumen;
  cargando: boolean;
  error: string;
  exportando: boolean;
  hayTrabajadores: boolean;
  hayVehiculos: boolean;
  trabajadores: FilaTrabajadorMes[];
  vehiculos: FilaVehiculoMes[];
  categorias: FilaCategoriaMes[];
  totalGastos: number;
  pagadoPorTi: number;
  hayGastos: boolean;
  onMes: (m: string) => void;
  onSeccion: (s: SeccionResumen) => void;
  onExportar: () => void;
  onAbrirTrabajador: (id: string) => void;
  onAbrirVehiculo: (id: string) => void;
  onAbrirCategoria: (categoria: string) => void;
};

/** Resumen del mes de la obra (RES-01…RES-05). */
export function VistaResumen(p: PropsResumen) {
  return (
    <div className="grid gap-4">
      <h1 className="sr-only">{tr("Resumen mensual")}</h1>
      <NavMes mes={p.mes} onCambio={p.onMes} />

      <Boton variante="secundario" grande ancho onClick={p.onExportar} cargando={p.exportando} icono={<Download size={20} aria-hidden />}>
        {tr("Exportar este mes a Excel")}
      </Boton>

      {/* Se parten en varias líneas en vez de deslizarse de lado: el arreglo
          del rebote del iPhone bloquea el gesto horizontal en toda la app (T-06). */}
      <Segmentos<SeccionResumen>
        etiqueta={tr("Resumen mensual")}
        valor={p.seccion}
        onCambio={p.onSeccion}
        opciones={[
          { valor: "trabajadores", texto: tr("Trabajadores") },
          { valor: "vehiculos", texto: tr("Vehículos") },
          { valor: "gastos", texto: tr("Gastos") },
        ]}
      />

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      {p.cargando ? (
        <CargandoBloque alto="bloque" />
      ) : p.seccion === "trabajadores" ? (
        <Trabajadores p={p} />
      ) : p.seccion === "vehiculos" ? (
        <Vehiculos p={p} />
      ) : (
        <Gastos p={p} />
      )}
    </div>
  );
}

function Trabajadores({ p }: { p: PropsResumen }) {
  if (!p.hayTrabajadores)
    return (
      <Panel>
        <Vacio titulo={tr("Todavía no hay trabajadores")} />
      </Panel>
    );
  if (p.trabajadores.every((f) => f.dias === 0))
    return (
      <Panel>
        <Vacio titulo={tr("Sin fichajes este mes")} texto={tr("Aquí verás cuántos días trabajó cada uno.")} />
      </Panel>
    );
  return (
    <Panel tono="honda" relleno="compacto">
      <ul className="grid gap-1.5">
        {p.trabajadores.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => p.onAbrirTrabajador(f.id)}
              className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-white/10"
              data-testid="fila-trabajador-mes"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base font-semibold">{f.nombre}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-peq text-sobre-honda-2">
                  <span>{trN(f.dias, "{n} día", "{n} días")}</span>
                  {f.extra > 0 && <Etiqueta tono="lima">{tr("+{horas} extra", { horas: fmtHoras(f.extra) })}</Etiqueta>}
                  {f.sinCerrar > 0 && <Etiqueta tono="coral">{tr("{n} sin salida", { n: f.sinCerrar })}</Etiqueta>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={clsx("cifras block text-titulo font-medium", f.trabajados === 0 && "opacity-60")}>
                  {f.trabajados > 0 ? fmtHoras(f.trabajados) : "—"}
                </span>
                <span className="block text-micro text-sobre-honda-2">{tr("trabajadas")}</span>
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 opacity-80" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Vehiculos({ p }: { p: PropsResumen }) {
  if (!p.hayVehiculos)
    return (
      <Panel>
        <Vacio titulo={tr("Todavía no hay vehículos")} />
      </Panel>
    );
  return (
    <Panel tono="honda" relleno="compacto">
      <ul className="grid gap-1.5">
        {p.vehiculos.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => p.onAbrirVehiculo(v.id)}
              className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-white/10"
            >
              <Truck size={20} aria-hidden strokeWidth={1.8} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base font-semibold">{v.nombre}</span>
                <span className="mt-0.5 block text-peq text-sobre-honda-2">
                  {v.dias > 0 ? tr("Toca para ver qué días y a qué obras") : tr("No se usó en esta obra este mes")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={clsx("cifras block text-titulo font-medium", v.dias === 0 && "opacity-60")}>{v.dias}</span>
                <span className="block text-micro text-sobre-honda-2">{trN(v.dias, "día", "días")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Gastos({ p }: { p: PropsResumen }) {
  if (!p.hayGastos)
    return (
      <Panel>
        <Vacio titulo={tr("Sin gastos este mes")} />
      </Panel>
    );
  return (
    <div className="grid gap-3">
      <Panel tono="honda">
        <h2 className="text-peq text-sobre-honda-2">{tr("Total del mes")}</h2>
        <p className="cifras mt-1 break-words text-cifra font-light tracking-[-0.03em]">{fmtEUR(p.totalGastos)}</p>
        {p.pagadoPorTi > 0 && (
          <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 rounded-[10px] bg-white/10 px-3 py-2.5 text-base">
            <span>{tr("Pagado por ti")}</span>
            <strong className="cifras font-semibold text-lima">{fmtEUR(p.pagadoPorTi)}</strong>
          </p>
        )}
      </Panel>

      <ul className="grid gap-2.5">
        {p.categorias.map((c) => {
          const Icono = ICONO_CATEGORIA[c.categoria] ?? ReceiptText;
          return (
            <li key={c.categoria}>
              <button
                type="button"
                onClick={() => p.onAbrirCategoria(c.categoria)}
                className="flex w-full min-w-0 items-start gap-3 rounded-panel bg-sup-honda px-3.5 py-3.5 text-left text-sobre-honda hover:brightness-110"
                data-testid="categoria-gastos"
              >
                <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-white/10">
                  <Icono size={20} aria-hidden strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 break-words text-base font-semibold">{tr(c.categoria)}</span>
                    <span className="cifras text-base font-semibold">{fmtEUR(c.total)}</span>
                  </span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-peq text-sobre-honda-2">
                    <span className="min-w-0 break-words">
                      {c.desde === c.hasta ? fmtDate(c.desde) : `${fmtDate(c.desde)} – ${fmtDate(c.hasta)}`} ·{" "}
                      {trN(c.n, "{n} gasto", "{n} gastos")}
                    </span>
                    <span className="cifras">{c.pct}%</span>
                  </span>
                  <span aria-hidden className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                    <span className="block h-full rounded-full bg-lima" style={{ width: `${Math.min(100, c.pct)}%` }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
