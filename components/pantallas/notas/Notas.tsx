"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  BUCKET_NOTAS,
  borrarArchivos,
  borrarNota,
  guardarNota,
  notaDelDia,
  rutaNota,
  subirArchivo,
  ultimasNotas,
  urlFirmada,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import type { NotaAudio } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { todayStr } from "@/lib/format";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaNotas } from "./VistaNotas";

/** Obra, día y audio anterior de la nota en el momento de EMPEZAR a grabar. */
type Destino = { obraId: string; fecha: string; anterior: string | undefined };

/**
 * Contenedor de las notas de voz (NOT-01…NOT-04): una nota por obra y día.
 *
 * Lección: si se cambia de día MIENTRAS se graba, la nota debe guardarse en
 * el día en que se empezó a grabar, no en el que se esté mirando al parar.
 * (v1 lo cumplía por casualidad, porque la función de guardado quedaba
 * capturada al empezar; aquí se apunta el destino de forma explícita.)
 */
export function Notas() {
  const db = useDb();
  const { obraActual } = useObra();
  const obraActualId = obraActual?.id ?? null;

  const [fecha, setFecha] = useState(todayStr());
  const [nota, setNota] = useState<NotaAudio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [urlAudio, setUrlAudio] = useState<string | null>(null);
  const [ultimas, setUltimas] = useState<NotaAudio[]>([]);

  const destino = useRef<Destino | null>(null);
  // Para ignorar respuestas de una lectura anterior (cambio rápido de día/obra).
  const lectura = useRef(0);

  const cargar = useCallback(async () => {
    if (!obraActualId) return;
    const mia = ++lectura.current;
    const [delDia, recientes] = await Promise.all([notaDelDia(db, obraActualId, fecha), ultimasNotas(db, obraActualId)]);
    if (mia !== lectura.current) return;
    setCargando(false);

    const fallo = delDia.error ?? recientes.error;
    if (fallo) {
      setErrorCarga(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar las notas.") : fallo.message);
      return;
    }
    setErrorCarga("");
    setNota(delDia.data ?? null);
    setUltimas(recientes.data ?? []);

    if (delDia.data) {
      const firmada = await urlFirmada(db, BUCKET_NOTAS, delDia.data.audio_path, 3600);
      if (mia !== lectura.current) return;
      setUrlAudio(firmada.data ?? null);
      if (firmada.error) setErrorCarga(firmada.error.message);
    } else {
      setUrlAudio(null);
    }
  }, [db, obraActualId, fecha]);

  useEffect(() => {
    setCargando(true);
    setNota(null);
    setUrlAudio(null);
    setErrorCarga("");
    cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  // La grabación en curso, al terminar, recarga lo que se esté mirando entonces.
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  const alEmpezar = () => {
    if (!obraActualId) return;
    destino.current = { obraId: obraActualId, fecha, anterior: nota?.audio_path };
  };

  const guardarGrabacion = async (blob: Blob, extension: string, segundos: number) => {
    const d = destino.current;
    if (!d) return;
    setSubiendo(true);
    setError("");

    const path = rutaNota(d.obraId, extension);
    const { error: errorSubida } = await subirArchivo(db, BUCKET_NOTAS, path, blob, blob.type || undefined);
    if (errorSubida) {
      setError(tr("No se pudo guardar el audio ({detalle}).", { detalle: errorSubida.message }));
      setSubiendo(false);
      return;
    }

    // Si ya había nota ese día, la sustituimos (y borramos el audio viejo).
    const { error: errorGuardar } = await guardarNota(db, {
      obra_id: d.obraId,
      fecha: d.fecha,
      audio_path: path,
      duracion_seg: segundos,
    });
    if (errorGuardar) {
      await borrarArchivos(db, BUCKET_NOTAS, [path]);
      setError(tr("No se pudo guardar la nota. Inténtalo de nuevo."));
      setSubiendo(false);
      return;
    }

    if (d.anterior) await borrarArchivos(db, BUCKET_NOTAS, [d.anterior]);
    destino.current = null;
    setSubiendo(false);
    await cargarRef.current();
  };

  const borrar = async () => {
    if (!nota) return;
    setError("");
    const { error: errorArchivo } = await borrarArchivos(db, BUCKET_NOTAS, [nota.audio_path]);
    if (errorArchivo) {
      setError(errorArchivo.message);
      return;
    }
    const { error: errorFila } = await borrarNota(db, nota.id);
    if (errorFila) {
      setError(errorFila.message);
      return;
    }
    await cargar();
  };

  if (!obraActual) return null;

  return (
    <VistaNotas
      cargando={cargando}
      errorCarga={errorCarga}
      error={error}
      fecha={fecha}
      nota={nota}
      urlAudio={urlAudio}
      subiendo={subiendo}
      ultimas={ultimas}
      onFecha={setFecha}
      onEmpezar={alEmpezar}
      onGrabado={guardarGrabacion}
      onBorrar={borrar}
    />
  );
}
