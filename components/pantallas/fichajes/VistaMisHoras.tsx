"use client";

import clsx from "clsx";
import { useState } from "react";
import { Building2, Car, LogIn, LogOut, MapPin, PenLine, UserX, Users } from "lucide-react";
import { tr, trJsx } from "@/lib/i18n";
import { currentMonth, monthLabel } from "@/lib/format";
import { fmtHoras, minutosExtra, minutosTrabajados } from "@/lib/horas";
import type { Fichaje, Transporte } from "@/lib/types";
import { Panel } from "@/components/ui/Panel";
import { NavDia } from "@/components/ui/Navegacion";
import { Aviso } from "@/components/ui/Aviso";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { Campo, Entrada } from "@/components/ui/Campo";
import { CargandoBloque } from "@/components/ui/Cargando";
import { HoraFija, Sello } from "./Sello";

/** ACC-12 — Cuenta aprobada pero sin enlazar todavía con su ficha de trabajador. */
export function FaltaUnPaso() {
  return (
    <div className="mx-auto max-w-sm px-1 py-14 text-center">
      <UserX size={32} aria-hidden className="mx-auto mb-3 opacity-80" />
      <h1 className="text-h1 font-medium">{tr("Falta un paso")}</h1>
      <p className="mt-2 text-base leading-relaxed">
        {tr("El dueño todavía no ha enlazado tu cuenta con tu ficha de trabajador. En cuanto lo haga, podrás fichar tus horas desde aquí.")}
      </p>
    </div>
  );
}

export type PropsMisHoras = {
  cargando: boolean;
  obraNombre: string;
  fecha: string;
  esHoy: boolean;
  fichaje: Fichaje | null;
  /** Totales del mes en minutos, sumando TODAS las obras (FIC-30). */
  mes: { trabajados: number; extra: number };
  jornadaHoras: number;
  error: string;
  pendienteEntrada: boolean;
  pendienteSalida: boolean;
  /** Campo recién sellado en esta sesión (para la animación del sello). */
  recien: "hora_entrada" | "hora_salida" | null;
  /** Hay un cambio del dueño (horas u obra) que el trabajador aún no ha confirmado (FIC-34). */
  porConfirmar: boolean;
  moduloTransporte: boolean;
  confirmando: boolean;
  onFecha: (f: string) => void;
  onCambiarObra: () => void;
  onFichar: (campo: "hora_entrada" | "hora_salida") => void;
  onConfirmar: () => void;
  onGuardarZona: (zona: string) => void;
  onGuardarTransporte: (t: Transporte, traidoPor: string | null) => void;
};

/**
 * Vista del trabajador (FIC-30…FIC-38): solo se ve a sí mismo. Una acción
 * grande —el sello de entrada o de salida— y, debajo, lo secundario.
 */
export function VistaMisHoras(p: PropsMisHoras) {
  const [editandoZona, setEditandoZona] = useState(false);
  const minutos = minutosTrabajados(p.fichaje?.hora_entrada, p.fichaje?.hora_salida);
  const extra = minutosExtra(minutos, p.jornadaHoras);
  const f = p.fichaje;

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-peq font-medium first-letter:uppercase">{tr("Mis horas · {mes}", { mes: monthLabel(currentMonth()) })}</h1>
        <p className="cifras mt-1 text-gigante font-light tracking-[-0.04em]" data-testid="horas-mes">
          {fmtHoras(p.mes.trabajados)}
        </p>
        <p className="mt-1 text-base">
          {p.mes.extra > 0 ? tr("{horas} extra este mes", { horas: fmtHoras(p.mes.extra) }) : tr("Total del mes")}
        </p>
      </header>

      <NavDia fecha={p.fecha} onCambio={p.onFecha} />

      <button
        type="button"
        onClick={p.onCambiarObra}
        className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-panel bg-sup px-4 py-2.5 text-left"
      >
        <Building2 size={18} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 break-words text-base">
          {tr("Estoy en")} <strong className="font-semibold">{p.obraNombre}</strong>
        </span>
        <span className="shrink-0 text-peq font-medium underline underline-offset-4">{tr("Cambiar")}</span>
      </button>

      {p.error && <Aviso tono="error">{p.error}</Aviso>}
      {(p.pendienteEntrada || p.pendienteSalida) && (
        <Aviso tono="sin-conexion">
          {tr("Sin conexión: tu fichaje está guardado en el móvil y se enviará solo en cuanto vuelva la señal.")}
        </Aviso>
      )}

      <Panel tono="honda" aria-busy={p.cargando || undefined}>
        {p.cargando ? (
          <CargandoBloque alto="bloque" />
        ) : (
          <>
            {minutos !== null && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="cifras text-titulo font-medium" data-testid="total-dia">
                  {fmtHoras(minutos)}
                </span>
                {extra > 0 && <Etiqueta tono="lima">{tr("+{horas} extra", { horas: fmtHoras(extra) })}</Etiqueta>}
              </div>
            )}

            {/* Si el dueño le ha corregido las horas (o movido de obra), que lo vea: es lo justo. */}
            {f?.hora_corregida && (
              <Etiqueta tono="suave" icono={<PenLine size={14} aria-hidden />} className="mb-3">
                {tr("Horas corregidas por el dueño")}
              </Etiqueta>
            )}
            {f && p.porConfirmar && (
              <div className="mb-3 rounded-[10px] bg-coral p-3 text-sobre-coral" data-testid="caja-confirmar">
                <p className="text-base">
                  {trJsx("Quedó así: {horas}. ¿Está bien?", {
                    horas: (
                      <strong className="cifras whitespace-nowrap font-semibold">
                        {f.hora_entrada ?? "—"} → {f.hora_salida ?? "—"}
                      </strong>
                    ),
                  })}
                </p>
                <Boton variante="secundario" ancho className="mt-2.5" onClick={p.onConfirmar} cargando={p.confirmando}>
                  {tr("Confirmo")}
                </Boton>
              </div>
            )}

            {p.esHoy ? (
              <div className="flex gap-2.5">
                <Sello
                  etiqueta={tr("Entrada")}
                  hora={f?.hora_entrada}
                  icono={LogIn}
                  onFichar={() => p.onFichar("hora_entrada")}
                  pendiente={p.pendienteEntrada}
                  recien={p.recien === "hora_entrada"}
                />
                <Sello
                  etiqueta={tr("Salida")}
                  hora={f?.hora_salida}
                  icono={LogOut}
                  onFichar={() => p.onFichar("hora_salida")}
                  bloqueada={!f?.hora_entrada && !p.pendienteEntrada}
                  pendiente={p.pendienteSalida}
                  recien={p.recien === "hora_salida"}
                />
              </div>
            ) : (
              <div className="flex gap-2.5">
                <HoraFija etiqueta={tr("Entrada")} hora={f?.hora_entrada} />
                <HoraFija etiqueta={tr("Salida")} hora={f?.hora_salida} />
              </div>
            )}

            {/* Zona / tarea: se apunta solo hoy (FIC-36) y solo con la entrada ya
                fichada, para no crear nunca una fila «fantasma» sin horas (T-30,
                FIC-06). Otros días se lee si existe. */}
            {p.esHoy && f?.hora_entrada ? (
              <button
                type="button"
                onClick={() => setEditandoZona(true)}
                className="mt-3 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-boton text-left text-base"
              >
                <MapPin size={18} aria-hidden className="shrink-0" />
                <span className={clsx("min-w-0 break-words", !f?.ubicacion && "underline underline-offset-4")}>
                  {f?.ubicacion || tr("Añadir zona / tarea")}
                </span>
              </button>
            ) : (
              f?.ubicacion && (
                <p className="mt-3 flex items-start gap-2 text-base">
                  <MapPin size={18} aria-hidden className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{f.ubicacion}</span>
                </p>
              )
            )}
          </>
        )}
      </Panel>

      {p.esHoy && p.moduloTransporte && !p.cargando && f?.hora_entrada && (
        <SelectorTransporte transporte={f?.transporte ?? null} traidoPor={f?.traido_por ?? null} onGuardar={p.onGuardarTransporte} />
      )}

      {!p.esHoy && (
        <p className="text-center text-base">{tr("Solo puedes fichar el día de hoy. Si falta algo de otro día, díselo al jefe.")}</p>
      )}

      {editandoZona && (
        <HojaTexto
          titulo={tr("Zona / tarea")}
          etiqueta={tr("¿Dónde has trabajado hoy?")}
          ejemplo={tr("Ej. Planta 2 — tabiquería")}
          inicial={f?.ubicacion ?? ""}
          boton={tr("Guardar")}
          onCerrar={() => setEditandoZona(false)}
          onGuardar={(v) => {
            p.onGuardarZona(v);
            setEditandoZona(false);
          }}
        />
      )}
    </div>
  );
}

/** Texto para la línea de transporte en la cuadrilla y en los resúmenes. */
export function textoTransporte(transporte: Transporte | null, traidoPor: string | null) {
  if (transporte === "propio") return tr("Vino en su coche");
  if (transporte === "traido") return traidoPor ? tr("Le trajo {nombre}", { nombre: traidoPor }) : tr("Le trajeron");
  return null;
}

/**
 * FIC-37 — Cómo llegó hoy a la obra. Quien le trajo se escribe a mano, a
 * propósito: así el trabajador no necesita ver la lista de la plantilla.
 */
function SelectorTransporte({
  transporte,
  traidoPor,
  onGuardar,
}: {
  transporte: Transporte | null;
  traidoPor: string | null;
  onGuardar: (t: Transporte, traidoPor: string | null) => void;
}) {
  const [pidiendoQuien, setPidiendoQuien] = useState(false);

  const opcion = (valor: Transporte, Icono: typeof Car, texto: string, onClick: () => void) => {
    const activo = transporte === valor;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activo}
        onClick={onClick}
        className={clsx(
          "flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-[10px] px-2 py-2.5 text-center text-peq font-medium leading-tight transition-colors",
          activo ? "bg-negro text-sobre-negro" : "bg-fondo/60 text-tinta hover:bg-fondo"
        )}
      >
        <Icono size={22} aria-hidden strokeWidth={1.8} className={activo ? "text-lima" : undefined} />
        <span className="min-w-0 break-words">{texto}</span>
      </button>
    );
  };

  return (
    <Panel>
      <h2 className="mb-2.5 text-base font-medium">{tr("¿Cómo has llegado?")}</h2>
      <div role="radiogroup" aria-label={tr("¿Cómo has llegado?")} className="flex gap-2.5">
        {opcion("propio", Car, tr("En mi coche"), () => {
          setPidiendoQuien(false);
          onGuardar("propio", null);
        })}
        {opcion("traido", Users, tr("Me trajeron"), () => setPidiendoQuien(true))}
      </div>
      {transporte === "traido" && (
        <button
          type="button"
          onClick={() => setPidiendoQuien(true)}
          className="mt-1.5 min-h-11 w-full rounded-boton text-center text-peq underline underline-offset-4"
        >
          {traidoPor ? tr("Le trajo {nombre} · cambiar", { nombre: traidoPor }) : tr("Decir quién te trajo")}
        </button>
      )}

      {/* Hoja aparte y no un campo pegado abajo (T-08): con el campo y el
          «Ok» juntos al fondo, el teclado tapaba el botón y no se podía
          confirmar. */}
      {pidiendoQuien && (
        <HojaTexto
          titulo={tr("¿Quién te trajo?")}
          etiqueta={tr("Nombre")}
          ejemplo={tr("Ej. Mi hermano, un compañero…")}
          inicial={traidoPor ?? ""}
          boton={tr("Ok")}
          onCerrar={() => setPidiendoQuien(false)}
          onGuardar={(v) => {
            onGuardar("traido", v || null);
            setPidiendoQuien(false);
          }}
        />
      )}
    </Panel>
  );
}

/** Hoja con un solo campo de texto y su botón, siempre por encima del teclado (T-08). */
export function HojaTexto({
  titulo,
  etiqueta,
  ejemplo,
  inicial,
  boton,
  onCerrar,
  onGuardar,
}: {
  titulo: string;
  etiqueta: string;
  ejemplo?: string;
  inicial: string;
  boton: string;
  onCerrar: () => void;
  onGuardar: (valor: string) => void;
}) {
  const [v, setV] = useState(inicial);
  return (
    <Hoja
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <Boton grande ancho type="submit" form="hoja-texto">
          {boton}
        </Boton>
      }
    >
      <form
        id="hoja-texto"
        onSubmit={(e) => {
          e.preventDefault();
          onGuardar(v.trim());
        }}
      >
        <Campo etiqueta={etiqueta} htmlFor="hoja-texto-campo">
          <Entrada id="hoja-texto-campo" value={v} onChange={(e) => setV(e.target.value)} placeholder={ejemplo} enterKeyHint="done" />
        </Campo>
      </form>
    </Hoja>
  );
}
