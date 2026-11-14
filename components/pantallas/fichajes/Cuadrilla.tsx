"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  corregirHoras,
  crearTrabajador,
  ficharCampo,
  fichajesDelDia,
  fichajesDelDiaOtrasObras,
  guardarZonaFichaje,
  historialFichaje,
  moverFichajeDeObra,
  trabajadoresActivos,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Fichaje, FichajeHistorial, Obra, Trabajador } from "@/lib/types";
import { esFalloDeRed, useFichajesPendientes } from "@/lib/offline-fichajes";
import { nowHHMM, todayStr } from "@/lib/format";
import { useEnRefresco } from "@/components/shell/Refresco";
import { Hoja } from "@/components/ui/Hoja";
import { SelectorObra } from "@/components/shell/SelectorObra";
import { VistaCuadrilla, type FilaCuadrilla } from "./VistaCuadrilla";
import { HojaCorregirHoras } from "./HojaCorregirHoras";
import { HojaTexto } from "./VistaMisHoras";

/**
 * Contenedor de la cuadrilla (FIC-10…FIC-24): el dueño, el manager y el
 * jefe de obra ven y fichan a todos. Corregir horas, mover de obra y quitar
 * un día son SOLO del dueño (lo impone la base; aquí se refleja).
 */
export function Cuadrilla() {
  const db = useDb();
  const { obraActual, obras, obraId, jornadaHoras, setObraId, crearObra } = useObra();
  const { esDueno, administra, modulos, userId } = useMiembro();

  const [fecha, setFecha] = useState(todayStr());
  const esHoy = fecha === todayStr();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  // Fichajes de ESE MISMO DÍA en las demás obras: para ver de un vistazo si
  // alguien estuvo además en otra obra (pasa a menudo).
  const [fichajesOtrasObras, setFichajesOtrasObras] = useState<Fichaje[]>([]);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [historial, setHistorial] = useState<FichajeHistorial[]>([]);
  const [zonaDe, setZonaDe] = useState<string | null>(null);
  const [cambiandoObra, setCambiandoObra] = useState(false);

  const obraActualId = obraActual?.id ?? null;

  const cargar = useCallback(async () => {
    if (!obraActualId) return;
    // La lista de trabajadores se relee con los fichajes (en v1 solo al
    // montar: ni el gesto de recargar ni el cambio de día la actualizaban, DIS-14).
    const [lista, propios, otros] = await Promise.all([
      trabajadoresActivos(db),
      fichajesDelDia(db, obraActualId, fecha),
      fichajesDelDiaOtrasObras(db, obraActualId, fecha),
    ]);
    setCargando(false);
    const fallo = lista.error ?? propios.error ?? otros.error;
    if (fallo) {
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar los fichajes.") : fallo.message);
      return;
    }
    setTrabajadores(lista.data ?? []);
    setFichajes(propios.data ?? []);
    setFichajesOtrasObras(otros.data ?? []);
  }, [db, obraActualId, fecha]);

  useEffect(() => {
    setCargando(true);
    setError("");
    cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  const registroDe = (trabajadorId: string) => fichajes.find((f) => f.trabajador_id === trabajadorId);

  /**
   * Otras obras donde ese trabajador también fichó ese día. Se devuelven
   * enteras (con su id) para saltar a ellas de un toque: si no, las horas
   * parecen haberse perdido cuando en realidad están en la otra obra.
   */
  const otrasObrasDe = (trabajadorId: string) =>
    fichajesOtrasObras
      .filter((f) => f.trabajador_id === trabajadorId && f.hora_entrada)
      .map((f) => obras.find((o) => o.id === f.obra_id))
      .filter((o): o is Obra => Boolean(o));

  const ponerEnLista = useCallback(
    (data: Fichaje) => {
      // Los reintentos de la cola pueden traer filas de otra obra u otro
      // día: solo entra en la lista lo que se está mirando (DIS-16).
      if (data.obra_id !== obraActualId || data.fecha !== fecha) return;
      setFichajes((prev) => {
        const idx = prev.findIndex((f) => f.id === data.id);
        if (idx === -1) return [...prev, data];
        const next = [...prev];
        next[idx] = data;
        return next;
      });
    },
    [obraActualId, fecha]
  );

  const { pendientes, encolar } = useFichajesPendientes(db, ponerEnLista, (_item, mensaje) => setError(mensaje));
  const pendienteDe = (trabajadorId: string, campo: "hora_entrada" | "hora_salida") =>
    pendientes.some((p) => p.trabajadorId === trabajadorId && p.fecha === fecha && p.campo === campo);

  const marcar = async (trabajadorId: string, campo: "hora_entrada" | "hora_salida") => {
    if (!obraActual) return;
    setError("");
    const hora = nowHHMM();
    // Salvo para el dueño, la base cambia esta hora por la del servidor:
    // lo que se enseña luego es lo que devuelve, no la del móvil (FIC-02).
    const { data, error: err } = await ficharCampo(db, obraActual.id, trabajadorId, fecha, campo, hora);
    if (data) {
      ponerEnLista(data);
      return;
    }
    // Sin cobertura en la obra: no se pierde el toque, queda en el móvil y
    // se envía solo en cuanto vuelva la señal (FIC-08).
    if (esFalloDeRed(err)) {
      encolar({ obraId: obraActual.id, trabajadorId, fecha, campo, hora });
      return;
    }
    if (err) setError(err.message);
  };

  /** Solo el dueño: pone las horas a mano y quedan marcadas como corregidas. */
  const guardarCorreccion = async (trabajadorId: string, entrada: string | null, salida: string | null) => {
    if (!obraActual) return tr("No hay obra elegida.");
    const { data, error: err } = await corregirHoras(db, obraActual.id, trabajadorId, fecha, entrada, salida);
    if (err) return err.message;
    if (data) ponerEnLista(data);
    setCorrigiendo(null);
    return null;
  };

  /**
   * El error del día: se fichó en la obra equivocada. Mueve el fichaje
   * entero (mismas horas) a la obra correcta, sin borrar y volver a crear.
   * Como cambia de obra, sale de la lista de este día en esta pantalla.
   */
  const moverObra = async (trabajadorId: string, nuevaObraId: string) => {
    const actual = registroDe(trabajadorId);
    if (!actual) return tr("No hay nada que mover todavía.");
    if (nuevaObraId === actual.obra_id) return null;
    const { data, error: err } = await moverFichajeDeObra(db, actual.id, nuevaObraId);
    if (err) return err.message;
    if (data) {
      setFichajes((prev) => prev.filter((f) => f.id !== data.id));
      setFichajesOtrasObras((prev) => [...prev, data]);
    }
    return null;
  };

  const guardarZona = async (trabajadorId: string, zona: string) => {
    if (!obraActual) return;
    setZonaDe(null);
    const { data, error: err } = await guardarZonaFichaje(db, obraActual.id, trabajadorId, fecha, zona);
    if (err) setError(esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message);
    if (data) ponerEnLista(data);
  };

  const anadirTrabajador = async (nombre: string) => {
    if (!userId) return tr("No se pudo guardar. Inténtalo otra vez.");
    const { data, error: err } = await crearTrabajador(db, userId, nombre);
    if (err) return err.message;
    if (data) setTrabajadores((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return null;
  };

  // Historial del fichaje que se está corrigiendo (FIC-23).
  const fichajeCorrigiendo = corrigiendo ? registroDe(corrigiendo) : undefined;
  const idFichajeCorrigiendo = fichajeCorrigiendo?.id ?? null;
  useEffect(() => {
    setHistorial([]);
    if (!idFichajeCorrigiendo) return;
    let vivo = true;
    historialFichaje(db, idFichajeCorrigiendo).then(({ data }) => {
      if (vivo) setHistorial(data ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [db, idFichajeCorrigiendo]);

  if (!obraActual) return null;

  const filas: FilaCuadrilla[] = trabajadores.map((t) => ({
    trabajador: t,
    fichaje: registroDe(t.id),
    otrasObras: otrasObrasDe(t.id),
    pendienteEntrada: pendienteDe(t.id, "hora_entrada"),
    pendienteSalida: pendienteDe(t.id, "hora_salida"),
  }));

  return (
    <>
      <VistaCuadrilla
        cargando={cargando}
        obraNombre={obraActual.nombre}
        fecha={fecha}
        esHoy={esHoy}
        esDueno={esDueno}
        puedeAnadir={administra}
        jornadaHoras={jornadaHoras}
        moduloTransporte={modulos.transporte}
        filas={filas}
        error={error}
        enCola={pendientes.length}
        onFecha={setFecha}
        onCambiarObra={() => setCambiandoObra(true)}
        onIrAObra={setObraId}
        onMarcar={marcar}
        onZona={setZonaDe}
        onCorregir={setCorrigiendo}
        onAnadirTrabajador={anadirTrabajador}
      />

      {cambiandoObra && (
        <Hoja titulo={tr("Fichar en qué obra")} onCerrar={() => setCambiandoObra(false)}>
          <SelectorObra
            obras={obras}
            obraId={obraId}
            puedeCrear={administra}
            onElegir={(id) => {
              setObraId(id);
              setCambiandoObra(false);
            }}
            onCrear={async (nombre, direccion) => {
              const { error: fallo } = await crearObra(nombre, direccion);
              if (!fallo) setCambiandoObra(false);
              return fallo;
            }}
          />
        </Hoja>
      )}

      {zonaDe && (
        <HojaTexto
          titulo={tr("Zona / tarea")}
          etiqueta={tr("Dónde trabajó / qué tarea hizo")}
          ejemplo={tr("Ej. Planta 2 — demolición tabiquería")}
          inicial={registroDe(zonaDe)?.ubicacion || ""}
          boton={tr("Guardar")}
          onCerrar={() => setZonaDe(null)}
          onGuardar={(v) => guardarZona(zonaDe, v)}
        />
      )}

      {corrigiendo && esDueno && (
        <HojaCorregirHoras
          key={corrigiendo}
          nombre={trabajadores.find((t) => t.id === corrigiendo)?.nombre ?? ""}
          fecha={fecha}
          entrada={fichajeCorrigiendo?.hora_entrada ?? null}
          salida={fichajeCorrigiendo?.hora_salida ?? null}
          hayFichaje={Boolean(fichajeCorrigiendo)}
          otrasObras={obras.filter((o) => o.activa && o.id !== (fichajeCorrigiendo?.obra_id ?? obraActual.id))}
          historial={historial}
          nombreObra={(id) => obras.find((o) => o.id === id)?.nombre ?? tr("otra obra")}
          onGuardar={(e, s) => guardarCorreccion(corrigiendo, e, s)}
          onMoverObra={(nuevaObraId) => moverObra(corrigiendo, nuevaObraId)}
          onCerrar={() => setCorrigiendo(null)}
        />
      )}
    </>
  );
}
