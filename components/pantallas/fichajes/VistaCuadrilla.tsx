"use client";

import { useState } from "react";
import { Building2, Car, LogIn, LogOut, MapPin, PenLine, Plus } from "lucide-react";
import { tr, trN } from "@/lib/i18n";
import { fmtHoras, minutosExtra, minutosTrabajados } from "@/lib/horas";
import type { Fichaje, Obra, Trabajador } from "@/lib/types";
import { Panel } from "@/components/ui/Panel";
import { NavDia } from "@/components/ui/Navegacion";
import { Aviso } from "@/components/ui/Aviso";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Boton } from "@/components/ui/Boton";
import { Vacio } from "@/components/ui/Vacio";
import { Campo, Entrada } from "@/components/ui/Campo";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Sello } from "./Sello";
import { textoTransporte } from "./VistaMisHoras";

export type FilaCuadrilla = {
  trabajador: Trabajador;
  fichaje: Fichaje | undefined;
  /** Otras obras donde también fichó ese día (para saltar a ellas de un toque). */
  otrasObras: Obra[];
  pendienteEntrada: boolean;
  pendienteSalida: boolean;
};

export type PropsCuadrilla = {
  cargando: boolean;
  obraNombre: string;
  fecha: string;
  esHoy: boolean;
  esDueno: boolean;
  /** Dueño o manager: pueden añadir trabajadores (la base no deja al jefe de obra). */
  puedeAnadir: boolean;
  jornadaHoras: number;
  moduloTransporte: boolean;
  filas: FilaCuadrilla[];
  error: string;
  /** Fichajes en cola en este móvil. */
  enCola: number;
  onFecha: (f: string) => void;
  onCambiarObra: () => void;
  onIrAObra: (id: string) => void;
  onMarcar: (trabajadorId: string, campo: "hora_entrada" | "hora_salida") => void;
  onZona: (trabajadorId: string) => void;
  onCorregir: (trabajadorId: string) => void;
  /** Devuelve un mensaje de error o null. */
  onAnadirTrabajador: (nombre: string) => Promise<string | null>;
};

/**
 * Vista de la cuadrilla (FIC-10…FIC-16): el gestor ficha a todos. Una
 * tarjeta por trabajador ACTIVO de la empresa, por orden alfabético.
 */
export function VistaCuadrilla(p: PropsCuadrilla) {
  return (
    <div className="grid gap-4">
      <h1 className="sr-only">{tr("Fichajes")}</h1>
      <NavDia fecha={p.fecha} onCambio={p.onFecha} />

      {/* Deja claro en qué obra se está fichando y permite cambiarla aquí
          mismo, sin subir al selector de arriba. */}
      <button
        type="button"
        onClick={p.onCambiarObra}
        className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-panel bg-sup px-4 py-2.5 text-left"
      >
        <Building2 size={18} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 break-words text-base">
          {tr("Fichando en")} <strong className="font-semibold">{p.obraNombre}</strong>
        </span>
        <span className="shrink-0 text-peq font-medium underline underline-offset-4">{tr("Cambiar")}</span>
      </button>

      {!p.esHoy && (
        <p className="text-center text-base">
          {p.esDueno
            ? tr("Otro día: toca «Corregir horas» en quien haga falta.")
            : tr("Las horas de otros días solo las puede cambiar el dueño.")}
        </p>
      )}

      {p.error && <Aviso tono="error">{p.error}</Aviso>}
      {p.enCola > 0 && (
        <Aviso tono="sin-conexion">
          {trN(
            p.enCola,
            "Sin conexión: {n} fichaje en cola, se enviará solo en cuanto vuelva la señal.",
            "Sin conexión: {n} fichajes en cola, se enviarán solos en cuanto vuelva la señal."
          )}
        </Aviso>
      )}

      {p.cargando ? (
        <CargandoBloque alto="bloque" />
      ) : p.filas.length === 0 ? (
        <Panel>
          <Vacio titulo={tr("Todavía no hay trabajadores")} texto={tr("Añade el primero para empezar a fichar.")} />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {p.filas.map((fila) => (
            <li key={fila.trabajador.id} className="min-w-0">
              <TarjetaTrabajador fila={fila} p={p} />
            </li>
          ))}
        </ul>
      )}

      {p.puedeAnadir && !p.cargando && <AnadirTrabajador onAnadir={p.onAnadirTrabajador} />}
    </div>
  );
}

function TarjetaTrabajador({ fila, p }: { fila: FilaCuadrilla; p: PropsCuadrilla }) {
  const { trabajador: t, fichaje: r, otrasObras } = fila;
  const min = minutosTrabajados(r?.hora_entrada, r?.hora_salida);
  const extra = minutosExtra(min, p.jornadaHoras);
  const transporte = p.moduloTransporte ? textoTransporte(r?.transporte ?? null, r?.traido_por ?? null) : null;

  return (
    <Panel como="article" relleno="compacto" className="flex h-full flex-col gap-2.5" data-testid="tarjeta-trabajador">
      <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="min-w-0 break-words text-base font-semibold">{t.nombre}</h2>
        {min !== null && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="cifras text-base font-medium">{fmtHoras(min)}</span>
            {extra > 0 && <Etiqueta tono="lima">{tr("+{horas} extra", { horas: fmtHoras(extra) })}</Etiqueta>}
          </span>
        )}
      </header>

      {otrasObras.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 text-peq">
          <span>{tr("También hoy en:")}</span>
          {otrasObras.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => p.onIrAObra(o.id)}
              className="-my-2 inline-flex min-h-11 items-center break-words text-left font-semibold underline underline-offset-4"
            >
              {o.nombre}
            </button>
          ))}
        </p>
      )}

      {(r?.hora_corregida || r?.ubicacion_ok === false) && (
        <div className="flex flex-wrap gap-1.5">
          {r.hora_corregida && (
            <>
              <Etiqueta tono="suave" icono={<PenLine size={14} aria-hidden />}>
                {tr("Horas corregidas por el dueño")}
              </Etiqueta>
              {/* «Sin confirmar» solo tiene sentido si hubo corrección: la base
                  baja «confirmado» también con la salida normal (DIS-10). */}
              <Etiqueta tono={r.confirmado_trabajador ? "lima" : "coral"}>
                {r.confirmado_trabajador ? tr("Confirmado") : tr("Sin confirmar")}
              </Etiqueta>
            </>
          )}
          {r.ubicacion_ok === false && (
            <Etiqueta tono="coral" icono={<MapPin size={14} aria-hidden />}>
              {tr("Fichó fuera de la obra")}
              {r.distancia_metros != null && ` ${tr("(a {m} m)", { m: r.distancia_metros })}`}
            </Etiqueta>
          )}
        </div>
      )}

      {/* Cómo llegó a la obra, si lo apuntó él desde su móvil. */}
      {transporte && (
        <p className="flex items-center gap-1.5 text-peq">
          <Car size={15} aria-hidden className="shrink-0" /> {transporte}
        </p>
      )}

      {/* Fichar es solo de hoy y a la hora de ahora (FIC-14). Otro día, los
          sellos solo enseñan lo que hay. */}
      <div className="mt-auto flex gap-2">
        <Sello
          compacto
          etiqueta={tr("Entrada")}
          hora={r?.hora_entrada}
          icono={LogIn}
          onFichar={() => p.onMarcar(t.id, "hora_entrada")}
          bloqueada={!p.esHoy}
          pendiente={fila.pendienteEntrada}
        />
        <Sello
          compacto
          etiqueta={tr("Salida")}
          hora={r?.hora_salida}
          icono={LogOut}
          onFichar={() => p.onMarcar(t.id, "hora_salida")}
          bloqueada={!p.esHoy || (!r?.hora_entrada && !fila.pendienteEntrada)}
          pendiente={fila.pendienteSalida}
        />
      </div>

      {/* Zona/tarea: solo con la entrada fichada, para no crear filas sin horas (T-30). */}
      {(r?.hora_entrada || r?.ubicacion) && (
        <button
          type="button"
          onClick={() => p.onZona(t.id)}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-boton text-left text-peq"
        >
          <MapPin size={16} aria-hidden className="shrink-0" />
          <span className={r?.ubicacion ? "min-w-0 break-words" : "min-w-0 underline underline-offset-4"}>
            {r?.ubicacion || tr("Añadir zona/tarea")}
          </span>
        </button>
      )}

      {p.esDueno && (
        <Boton
          variante="secundario"
          ancho
          onClick={() => p.onCorregir(t.id)}
          icono={<PenLine size={16} aria-hidden />}
          data-testid="corregir-horas"
        >
          {tr("Corregir horas")}
        </Boton>
      )}
    </Panel>
  );
}

/** FIC-15 — Alta rápida de un trabajador (solo dueño/manager; el error se enseña). */
function AnadirTrabajador({ onAnadir }: { onAnadir: (nombre: string) => Promise<string | null> }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (!abierto) {
    return (
      <Boton variante="suave" ancho icono={<Plus size={18} aria-hidden />} onClick={() => setAbierto(true)}>
        {tr("Añadir trabajador")}
      </Boton>
    );
  }
  return (
    <Panel>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nombre.trim()) return;
          setGuardando(true);
          setError("");
          const fallo = await onAnadir(nombre.trim());
          setGuardando(false);
          if (fallo) {
            setError(fallo);
            return;
          }
          setNombre("");
          setAbierto(false);
        }}
      >
        <Campo etiqueta={tr("Nombre del trabajador")} htmlFor="nuevo-trabajador" error={error || undefined}>
          <Entrada id="nuevo-trabajador" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Boton type="submit" className="flex-1" disabled={!nombre.trim()} cargando={guardando}>
            {tr("Añadir")}
          </Boton>
          <Boton
            variante="suave"
            className="flex-1"
            onClick={() => {
              setAbierto(false);
              setNombre("");
              setError("");
            }}
          >
            {tr("Cancelar")}
          </Boton>
        </div>
      </form>
    </Panel>
  );
}
