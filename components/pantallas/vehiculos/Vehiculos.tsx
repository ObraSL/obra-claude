"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  actualizarUsoVehiculo,
  borrarUsoVehiculo,
  crearUsoVehiculo,
  crearVehiculo,
  trabajadoresActivos,
  usosVehiculoDelDia,
  vehiculosActivos,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Trabajador, UsoVehiculo, Vehiculo } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { todayStr } from "@/lib/format";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaVehiculos, type FilaVehiculo } from "./VistaVehiculos";
import { HojaVehiculoDia, type DatosUso } from "./HojaVehiculoDia";

/**
 * Coches: qué día se usó cada uno, quién lo llevó y a qué obras fue.
 *
 * Ya no se apuntan km: no hay forma fiable de leerlos. Y un coche puede ir a
 * varias obras el mismo día (el del dueño, sobre todo), así que cada obra
 * del día es un apunte propio. Se ven todas las obras, no solo la elegida
 * arriba: si no, un coche que hoy estuvo en otra obra parecía sin usar.
 *
 * Añadir vehículo: solo dueño y manager (la base rechaza al jefe de obra,
 * DIS-22). El trabajador lo ve todo de lectura.
 */
export function Vehiculos() {
  const db = useDb();
  const { obraActual, obras } = useObra();
  const { esTrabajador, administra, userId } = useMiembro();

  const [fecha, setFecha] = useState(todayStr());
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [usos, setUsos] = useState<UsoVehiculo[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargandoFijos, setCargandoFijos] = useState(true);
  const [cargandoUsos, setCargandoUsos] = useState(true);
  const [errorFijos, setErrorFijos] = useState("");
  const [errorUsos, setErrorUsos] = useState("");

  const mensaje = (e: { message: string }, sinRed: string) => (esFalloDeRed(e) ? sinRed : e.message);

  // Vehículos y trabajadores: no dependen del día.
  const cargarFijos = useCallback(async () => {
    const [v, t] = await Promise.all([vehiculosActivos(db), trabajadoresActivos(db)]);
    setCargandoFijos(false);
    const fallo = v.error ?? t.error;
    if (fallo) {
      setErrorFijos(mensaje(fallo, tr("Sin conexión. No se han podido cargar los vehículos.")));
      return;
    }
    setErrorFijos("");
    setVehiculos(v.data ?? []);
    setTrabajadores(t.data ?? []);
  }, [db]);

  const cargarUsos = useCallback(async () => {
    const { data, error } = await usosVehiculoDelDia(db, fecha);
    setCargandoUsos(false);
    if (error) {
      setErrorUsos(mensaje(error, tr("Sin conexión. No se han podido cargar los vehículos.")));
      return;
    }
    setErrorUsos("");
    setUsos(data ?? []);
  }, [db, fecha]);

  useEffect(() => {
    cargarFijos();
  }, [cargarFijos]);

  useEffect(() => {
    setCargandoUsos(true);
    cargarUsos();
  }, [cargarUsos]);

  useEnRefresco(() => Promise.all([cargarFijos(), cargarUsos()]).then(() => undefined));

  const usosDe = (vehiculoId: string) => usos.filter((u) => u.vehiculo_id === vehiculoId);
  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? tr("Otra obra");
  const nombreConductor = (id: string | null) => trabajadores.find((t) => t.id === id)?.nombre;
  const cochesHoy = new Set(usos.map((u) => u.vehiculo_id)).size;

  const anadirVehiculo = async (nombre: string): Promise<string | null> => {
    if (!userId) return tr("No se pudo guardar. Inténtalo otra vez.");
    const { data, error } = await crearVehiculo(db, userId, nombre);
    if (error) return error.message;
    if (data) setVehiculos((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return null;
  };

  /** Guarda un apunte (nuevo o cambiado). Devuelve el fallo, si lo hay. */
  const guardarUso = async (vehiculoId: string, datos: DatosUso, usoId?: string): Promise<string | null> => {
    const destino = datos.destino.trim() || null;
    const { error } = usoId
      ? await actualizarUsoVehiculo(db, usoId, { obra_id: datos.obra_id, conductor_id: datos.conductor_id, destino })
      : await crearUsoVehiculo(db, { vehiculo_id: vehiculoId, fecha, obra_id: datos.obra_id, conductor_id: datos.conductor_id, destino });
    if (error) {
      return error.code === "23505" ? tr("Ese coche ya está apuntado en esa obra este día.") : error.message;
    }
    await cargarUsos();
    return null;
  };

  const borrarUso = async (usoId: string): Promise<string | null> => {
    const { error } = await borrarUsoVehiculo(db, usoId);
    if (error) return error.message;
    await cargarUsos();
    return null;
  };

  const vehiculoAbierto = vehiculos.find((v) => v.id === abierto);

  const filas: FilaVehiculo[] = vehiculos.map((v) => ({
    vehiculo: v,
    lineas: usosDe(v.id).map((u) => ({
      id: u.id,
      obraNombre: nombreObra(u.obra_id),
      conductor: nombreConductor(u.conductor_id),
      actual: u.obra_id === obraActual?.id,
    })),
  }));

  return (
    <>
      <VistaVehiculos
        cargando={cargandoFijos || cargandoUsos}
        error={errorFijos || errorUsos}
        fecha={fecha}
        filas={filas}
        cochesEnUso={cochesHoy}
        puedeAnadir={administra}
        onFecha={setFecha}
        onAbrir={setAbierto}
        onAnadirVehiculo={anadirVehiculo}
      />

      {vehiculoAbierto && (
        <HojaVehiculoDia
          key={`${vehiculoAbierto.id}-${fecha}`}
          nombre={vehiculoAbierto.nombre}
          fecha={fecha}
          usos={usosDe(vehiculoAbierto.id)}
          obras={obras}
          trabajadores={trabajadores}
          obraPorDefecto={obraActual?.id ?? obras[0]?.id ?? ""}
          puedeEditar={!esTrabajador}
          onGuardar={(datos, usoId) => guardarUso(vehiculoAbierto.id, datos, usoId)}
          onBorrar={borrarUso}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}
