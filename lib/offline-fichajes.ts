"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fichaje } from "@/lib/types";

/**
 * En la obra el 4G a veces no llega. Si el fichaje no sale, el trabajador no
 * puede quedarse esperando: se guarda aquí (en el propio móvil) y se reintenta
 * solo en cuanto vuelva la señal, sin que nadie tenga que acordarse.
 */
export type FichajePendiente = {
  id: string;
  obraId: string;
  trabajadorId: string;
  fecha: string;
  campo: "hora_entrada" | "hora_salida";
  hora: string;
  ubicacionOk?: boolean | null;
  distanciaMetros?: number | null;
  creadoEn: number;
};

const CLAVE = "obra_fichajes_pendientes";

function leerCola(): FichajePendiente[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]");
  } catch {
    return [];
  }
}

function escribirCola(lista: FichajePendiente[]) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Almacenamiento lleno o modo privado: se pierde la cola, no el fichaje
    // que ya se intentó, ni el resto de la app.
  }
}

/** Un fallo de red (sin cobertura, wifi caído) frente a un fallo real (regla
 *  de negocio, permisos): solo el primero merece cola y reintento — el
 *  segundo hay que enseñarlo tal cual, reintentarlo no lo arregla. */
export function esFalloDeRed(error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = (error.message || "").toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("load failed");
}

export function useFichajesPendientes(
  supabase: SupabaseClient,
  onConfirmado: (data: Fichaje) => void
) {
  const [pendientes, setPendientes] = useState<FichajePendiente[]>([]);
  const onConfirmadoRef = useRef(onConfirmado);
  const reintentando = useRef(false);

  useEffect(() => {
    onConfirmadoRef.current = onConfirmado;
  });

  useEffect(() => {
    setPendientes(leerCola());
  }, []);

  const encolar = useCallback((item: Omit<FichajePendiente, "id" | "creadoEn">) => {
    const nuevo: FichajePendiente = { ...item, id: crypto.randomUUID(), creadoEn: Date.now() };
    setPendientes((prev) => {
      const next = [...prev, nuevo];
      escribirCola(next);
      return next;
    });
  }, []);

  /** true = ya resuelto (con éxito o con un error real), sale de la cola. */
  const reintentarUno = useCallback(
    async (item: FichajePendiente): Promise<boolean> => {
      const { data, error } = await supabase
        .from("fichajes")
        .upsert(
          {
            obra_id: item.obraId,
            trabajador_id: item.trabajadorId,
            fecha: item.fecha,
            [item.campo]: item.hora,
            ...(item.ubicacionOk !== undefined ? { ubicacion_ok: item.ubicacionOk } : {}),
            ...(item.distanciaMetros !== undefined ? { distancia_metros: item.distanciaMetros } : {}),
          },
          { onConflict: "obra_id,trabajador_id,fecha" }
        )
        .select()
        .single();

      if (data) {
        onConfirmadoRef.current(data as Fichaje);
        return true;
      }

      // El primer intento sí pudo llegar al servidor y la respuesta fue lo
      // que se perdió: no es un fallo, hay que traer el valor real y parar.
      if (error && /ya está fichad/i.test(error.message)) {
        const { data: actual } = await supabase
          .from("fichajes")
          .select("*")
          .eq("obra_id", item.obraId)
          .eq("trabajador_id", item.trabajadorId)
          .eq("fecha", item.fecha)
          .maybeSingle();
        if (actual) onConfirmadoRef.current(actual as Fichaje);
        return true;
      }

      return !esFalloDeRed(error);
    },
    [supabase]
  );

  const reintentarTodos = useCallback(async () => {
    if (reintentando.current) return;
    const actuales = leerCola();
    if (actuales.length === 0) return;
    reintentando.current = true;
    const quedan: FichajePendiente[] = [];
    for (const item of actuales) {
      const resuelto = await reintentarUno(item);
      if (!resuelto) quedan.push(item);
    }
    escribirCola(quedan);
    setPendientes(quedan);
    reintentando.current = false;
  }, [reintentarUno]);

  useEffect(() => {
    window.addEventListener("online", reintentarTodos);
    const intervalo = setInterval(reintentarTodos, 20000);
    reintentarTodos();
    return () => {
      window.removeEventListener("online", reintentarTodos);
      clearInterval(intervalo);
    };
  }, [reintentarTodos]);

  return { pendientes, encolar };
}
