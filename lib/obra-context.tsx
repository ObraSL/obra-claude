"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDb } from "@/lib/datos/provider";
import {
  cambiarActivaObra,
  crearObra as crearObraDb,
  guardarJefeVeTodas as guardarJefeVeTodasDb,
  guardarJornada as guardarJornadaDb,
  leerAjustesJornada,
  listarObras,
} from "@/lib/datos/consultas";
import { useMiembro } from "@/lib/miembro-context";
import { tr } from "@/lib/i18n";
import type { Obra } from "@/lib/types";
import { todayStr } from "@/lib/format";

/** Obra actual recordada en el móvil (SHL-05). Misma clave que v1. */
const STORAGE_KEY = "control-de-obra:obra-id";
const JORNADA_POR_DEFECTO = 8;

type ObraContextValue = {
  obras: Obra[];
  obraActual: Obra | null;
  obraId: string | null;
  loading: boolean;
  /** No se pudieron leer las obras: NO es lo mismo que «no hay obras» (DIS-12). */
  error: string | null;
  setObraId: (id: string) => void;
  /** Devuelve la obra creada, o un mensaje de error. */
  crearObra: (nombre: string, direccion: string) => Promise<{ obra: Obra | null; error: string | null }>;
  toggleObraActiva: (id: string) => Promise<string | null>;
  refrescar: () => Promise<void>;
  /** Horas de la jornada normal: lo que pase de ahí cuenta como horas extra (FIC-03). */
  jornadaHoras: number;
  guardarJornada: (horas: number) => Promise<string | null>;
  /** Si un jefe de obra ve todas las obras de la empresa, o solo la suya. */
  jefeVeTodas: boolean;
  guardarJefeVeTodas: (valor: boolean) => Promise<string | null>;
};

const ObraContext = createContext<ObraContextValue | null>(null);

export function ObraProvider({ children }: { children: React.ReactNode }) {
  const db = useDb();
  const { userId } = useMiembro();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jornadaHoras, setJornadaHoras] = useState(JORNADA_POR_DEFECTO);
  const [jefeVeTodas, setJefeVeTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    leerAjustesJornada(db).then(({ data }) => {
      if (!vivo) return;
      if (data?.jornada_horas) setJornadaHoras(Number(data.jornada_horas));
      setJefeVeTodas(Boolean(data?.jefe_ve_todas));
    });
    return () => {
      vivo = false;
    };
  }, [db]);

  const guardarJornada = useCallback(
    async (horas: number) => {
      if (!userId) return null;
      const antes = jornadaHoras;
      setJornadaHoras(horas);
      const { error: err } = await guardarJornadaDb(db, userId, horas);
      if (err) {
        setJornadaHoras(antes);
        return err.message;
      }
      return null;
    },
    [db, userId, jornadaHoras]
  );

  const guardarJefeVeTodas = useCallback(
    async (valor: boolean) => {
      if (!userId) return null;
      setJefeVeTodas(valor);
      const { error: err } = await guardarJefeVeTodasDb(db, userId, valor);
      if (err) {
        setJefeVeTodas(!valor);
        return err.message;
      }
      return null;
    },
    [db, userId]
  );

  const cargar = useCallback(async () => {
    const { data, error: err } = await listarObras(db);
    if (err) {
      setError(err.message);
    } else if (data) {
      setError(null);
      setObras(data);
      // Si ya hay una obra elegida en esta sesión (aunque esté cerrada: puede
      // haberse abierto a propósito desde Ajustes), se respeta. Solo el
      // arranque en frío prefiere una obra activa: no tiene sentido empezar
      // el día en la última guardada si ahora está cerrada.
      const activas = data.filter((o) => o.activa);
      setObraIdState((actual) => {
        if (actual && data.some((o) => o.id === actual)) return actual;
        const guardada = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (guardada && activas.some((o) => o.id === guardada)) return guardada;
        return activas[0]?.id ?? data[0]?.id ?? null;
      });
    }
    setLoading(false);
  }, [db]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setObraId = useCallback((id: string) => {
    setObraIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Modo privado o almacenamiento lleno: la obra vale para esta sesión.
    }
  }, []);

  const crearObra = useCallback(
    async (nombre: string, direccion: string) => {
      if (!userId) return { obra: null, error: tr("No se pudo guardar. Inténtalo otra vez.") };
      const { data, error: err } = await crearObraDb(db, userId, nombre, direccion);
      if (err || !data) return { obra: null, error: err?.message ?? tr("No se pudo guardar. Inténtalo otra vez.") };
      setObras((prev) => [data, ...prev]);
      setObraId(data.id);
      return { obra: data, error: null };
    },
    [db, userId, setObraId]
  );

  const toggleObraActiva = useCallback(
    async (id: string) => {
      const obra = obras.find((o) => o.id === id);
      if (!obra) return null;
      const { data, error: err } = await cambiarActivaObra(db, id, !obra.activa);
      if (err) return err.message;
      if (data) setObras((prev) => prev.map((o) => (o.id === id ? data : o)));
      return null;
    },
    [db, obras]
  );

  const obraActual = obras.find((o) => o.id === obraId) ?? null;

  const value: ObraContextValue = {
    obras,
    obraActual,
    obraId,
    loading,
    error,
    setObraId,
    crearObra,
    toggleObraActiva,
    refrescar: cargar,
    jornadaHoras,
    guardarJornada,
    jefeVeTodas,
    guardarJefeVeTodas,
  };

  return <ObraContext.Provider value={value}>{children}</ObraContext.Provider>;
}

export function useObra() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObra debe usarse dentro de <ObraProvider>");
  return ctx;
}

// Se re-exporta para que las pantallas no importen de dos sitios solo para saber «hoy».
export { todayStr };
