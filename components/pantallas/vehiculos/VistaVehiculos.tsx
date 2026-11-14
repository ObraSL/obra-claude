"use client";

import { useState } from "react";
import { ChevronRight, Plus, Truck } from "lucide-react";
import { tr, trN } from "@/lib/i18n";
import type { Vehiculo } from "@/lib/types";
import { Panel } from "@/components/ui/Panel";
import { NavDia } from "@/components/ui/Navegacion";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Vacio } from "@/components/ui/Vacio";
import { Campo, Entrada } from "@/components/ui/Campo";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Hoja } from "@/components/ui/Hoja";

/** Una obra a la que fue un coche ese día (una línea de su tarjeta). */
export type LineaObra = {
  id: string;
  obraNombre: string;
  /** Nombre del conductor, si se apuntó. */
  conductor?: string;
  /** Es la obra elegida arriba: se destaca (con punto y palabra, no solo color). */
  actual: boolean;
};

export type FilaVehiculo = {
  vehiculo: Vehiculo;
  lineas: LineaObra[];
};

export type PropsVistaVehiculos = {
  cargando: boolean;
  error: string;
  fecha: string;
  filas: FilaVehiculo[];
  /** Coches distintos con algún apunte ese día. */
  cochesEnUso: number;
  /** Solo dueño y manager (DIS-22: el jefe de obra no lo ve, la base lo rechaza). */
  puedeAnadir: boolean;
  onFecha: (f: string) => void;
  onAbrir: (vehiculoId: string) => void;
  /** Devuelve un mensaje de error o null. */
  onAnadirVehiculo: (nombre: string) => Promise<string | null>;
};

/**
 * Vista de vehículos (VEH-01…VEH-04): qué día se usó cada coche, quién lo
 * llevó y a qué obras fue. Se ven TODAS las obras del día, no solo la elegida.
 */
export function VistaVehiculos(p: PropsVistaVehiculos) {
  const [anadiendo, setAnadiendo] = useState(false);

  return (
    <div className="grid gap-4">
      <h1 className="sr-only">{tr("Vehículos")}</h1>
      <NavDia fecha={p.fecha} onCambio={p.onFecha} />

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      {p.cargando ? (
        <CargandoBloque alto="bloque" />
      ) : (
        <>
          {p.filas.length > 0 && (
            <Panel tono="honda" relleno="compacto" data-testid="contador-coches">
              {p.cochesEnUso === 0 ? (
                <p className="text-base font-medium">{tr("Ningún coche apuntado este día")}</p>
              ) : (
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="cifras text-cifra font-light leading-none tracking-[-0.04em]">{p.cochesEnUso}</span>
                  <span className="min-w-0 break-words text-base font-medium">
                    {trN(p.cochesEnUso, "{n} coche en uso este día", "{n} coches en uso este día")}
                  </span>
                </p>
              )}
            </Panel>
          )}

          {p.filas.length === 0 ? (
            <Panel>
              <Vacio
                titulo={tr("Todavía no hay vehículos")}
                texto={tr("Añade el primero para apuntar quién lo lleva y a qué obra.")}
              />
            </Panel>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {p.filas.map(({ vehiculo: v, lineas }) => (
                <li key={v.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => p.onAbrir(v.id)}
                    data-testid="tarjeta-vehiculo"
                    className="flex min-h-14 w-full min-w-0 items-start gap-3 rounded-panel bg-sup p-3.5 text-left text-tinta"
                  >
                    <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-fondo/60">
                      <Truck size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-semibold">{v.nombre}</span>
                      {lineas.length === 0 ? (
                        <span className="mt-0.5 block text-peq text-tinta-2">{tr("Sin usar este día")}</span>
                      ) : (
                        <span className="mt-1 grid gap-1">
                          {lineas.map((l) => (
                            <span key={l.id} className="flex min-w-0 items-start gap-2 text-peq">
                              <span
                                aria-hidden
                                className={l.actual ? "mt-[7px] size-2 shrink-0 rounded-full bg-lima ring-1 ring-negro/40" : "mt-[7px] size-2 shrink-0 rounded-full bg-tinta/30"}
                              />
                              <span className="min-w-0 break-words">
                                <span className={l.actual ? "font-semibold" : undefined}>{l.obraNombre}</span>
                                {l.conductor ? ` · ${tr("Lo llevó {nombre}", { nombre: l.conductor })}` : ""}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} aria-hidden className="mt-2 shrink-0 opacity-60" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {p.puedeAnadir && (
            <Boton variante="suave" ancho icono={<Plus size={18} aria-hidden />} onClick={() => setAnadiendo(true)} data-testid="anadir-vehiculo">
              {tr("Añadir vehículo")}
            </Boton>
          )}
        </>
      )}

      {anadiendo && p.puedeAnadir && <HojaNuevoVehiculo onAnadir={p.onAnadirVehiculo} onCerrar={() => setAnadiendo(false)} />}
    </div>
  );
}

/** VEH-04 — Alta de un vehículo (solo dueño/manager; el error de la base se enseña). */
function HojaNuevoVehiculo({ onAnadir, onCerrar }: { onAnadir: (nombre: string) => Promise<string | null>; onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError("");
    const fallo = await onAnadir(nombre.trim());
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    onCerrar();
  };

  return (
    <Hoja
      titulo={tr("Añadir vehículo")}
      onCerrar={onCerrar}
      pie={
        <div className="flex flex-wrap gap-2">
          <Boton variante="suave" className="flex-1" onClick={onCerrar}>
            {tr("Cancelar")}
          </Boton>
          <Boton grande className="flex-1" disabled={!nombre.trim()} cargando={guardando} onClick={guardar}>
            {tr("Añadir")}
          </Boton>
        </div>
      }
    >
      <form
        className="grid gap-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {/* El nombre del campo es el ejemplo de v1: no hay otra etiqueta en v1. */}
        <Campo etiqueta={tr("Añadir vehículo")} htmlFor="nuevo-vehiculo" error={error || undefined}>
          <Entrada
            id="nuevo-vehiculo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tr("Ej. Furgoneta — 1234 ABC")}
            autoComplete="off"
          />
        </Campo>
      </form>
    </Hoja>
  );
}
