"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  actualizarTarea,
  borrarTarea,
  borrarTareasDeObra,
  crearTarea,
  crearTareas,
  tareasDeObra,
  type CamposTarea,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { todayStr } from "@/lib/format";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import type { Tarea } from "@/lib/types";
import type { ResultadoImport } from "@/lib/importar-excel";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaPlanificacion } from "./VistaPlanificacion";
import { HojaTarea } from "./HojaTarea";
import { HojaImportarExcel } from "./HojaImportarExcel";

/** Mensaje de una escritura fallida: el del servidor tal cual, o «sin conexión». */
const mensajeEscritura = (err: { message: string }) =>
  esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message;

/**
 * Contenedor de Planificación: el diagrama de Gantt con las tareas, sus
 * fechas y cuánto lleva hecho cada una. De aquí sale el porcentaje de avance
 * de la portada. Solo gestores (la ruta ya lo guarda). Los errores de
 * escritura se devuelven a la hoja abierta, que los enseña dentro (PLA-06).
 */
export function Planificacion() {
  const db = useDb();
  const { obraActual } = useObra();
  const obraId = obraActual?.id ?? null;

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [anadiendo, setAnadiendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState<Tarea | null>(null);
  const hoy = todayStr();

  const cargar = useCallback(async () => {
    if (!obraId) return;
    const { data, error: err } = await tareasDeObra(db, obraId);
    setCargando(false);
    // Si algo falla, que se vea (y se conserva lo que ya había): si no, la
    // pantalla se queda vacía sin explicar por qué y parece que la app se ha
    // comido las tareas.
    if (err) {
      setError(esFalloDeRed(err) ? tr("Sin conexión. No se ha podido cargar el plan.") : err.message);
      return;
    }
    setError("");
    setTareas(data ?? []);
  }, [db, obraId]);

  useEffect(() => {
    setCargando(true);
    setError("");
    cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  if (!obraActual) return null;

  const siguienteOrden = () => (tareas.length === 0 ? 0 : Math.max(...tareas.map((t) => t.orden)) + 1);

  const anadir = async (d: CamposTarea): Promise<string | null> => {
    const { error: err } = await crearTarea(db, { obra_id: obraActual.id, ...d, orden: siguienteOrden() });
    if (err) return mensajeEscritura(err);
    setAnadiendo(false);
    await cargar();
    return null;
  };

  const guardarCambios = async (d: CamposTarea): Promise<string | null> => {
    if (!editando) return null;
    const { error: err } = await actualizarTarea(db, editando.id, d);
    if (err) return mensajeEscritura(err);
    setEditando(null);
    await cargar();
    return null;
  };

  const borrar = async (): Promise<string | null> => {
    if (!editando) return null;
    const { error: err } = await borrarTarea(db, editando.id);
    if (err) return mensajeEscritura(err);
    setEditando(null);
    await cargar();
    return null;
  };

  /**
   * Mete en el plan los capítulos leídos del Excel. Devuelve el fallo, si lo hay.
   * Reemplazar = borrar todo y luego insertar; la base no tiene transacción
   * para esto. Si el alta falla tras el borrado (DIS-26) se dice claramente y
   * se recarga: lo anterior ya no está, y la vista previa sigue para reintentar.
   */
  const importar = async (r: ResultadoImport, reemplazar: boolean): Promise<string | null> => {
    if (reemplazar) {
      const { error: errBorrar } = await borrarTareasDeObra(db, obraActual.id);
      if (errBorrar) return mensajeEscritura(errBorrar);
    }

    const desde = reemplazar ? 0 : siguienteOrden();
    const { error: errMeter } = await crearTareas(
      db,
      r.secciones.map((s, i) => ({
        obra_id: obraActual.id,
        nombre: s.nombre,
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        avance: 0,
        orden: desde + i,
        presupuesto: s.presupuesto,
      }))
    );
    if (errMeter) {
      if (reemplazar) {
        await cargar();
        return tr("Se han borrado las tareas anteriores, pero no se han podido guardar las nuevas: {error}. Vuelve a intentarlo.", {
          error: mensajeEscritura(errMeter),
        });
      }
      return mensajeEscritura(errMeter);
    }

    setImportando(false);
    await cargar();
    return null;
  };

  return (
    <>
      <VistaPlanificacion
        cargando={cargando}
        error={error}
        tareas={tareas}
        hoy={hoy}
        onAnadir={() => setAnadiendo(true)}
        onImportar={() => setImportando(true)}
        onElegir={setEditando}
      />

      {anadiendo && <HojaTarea onGuardar={anadir} onCerrar={() => setAnadiendo(false)} />}
      {editando && <HojaTarea tarea={editando} onGuardar={guardarCambios} onBorrar={borrar} onCerrar={() => setEditando(null)} />}
      {importando && <HojaImportarExcel hayTareas={tareas.length} onImportar={importar} onCerrar={() => setImportando(false)} />}
    </>
  );
}
