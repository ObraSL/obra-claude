"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CargandoBloque } from "@/components/ui/Cargando";
import { MODO_MEMORIA, type Db } from "./db";

/**
 * Reparte el cliente de datos a toda la app (D-08).
 * - Producción: el cliente de Supabase del navegador, como en v1.
 * - Modo demo (NEXT_PUBLIC_DATOS=memoria): el motor en memoria, que se
 *   carga con import dinámico para que NO entre en el JS de producción.
 * - Galería: recibe el cliente ya construido por la prop `db`.
 */
const DbContext = createContext<Db | null>(null);

export function DatosProvider({ db: dbDado, children }: { db?: Db; children: React.ReactNode }) {
  const [propio, setPropio] = useState<Db | null>(() => (dbDado || MODO_MEMORIA ? null : createClient()));

  useEffect(() => {
    if (dbDado || propio || !MODO_MEMORIA) return;
    let vivo = true;
    import("./demo").then((m) => {
      if (vivo) setPropio(m.dbDemo());
    });
    return () => {
      vivo = false;
    };
  }, [dbDado, propio]);

  const db = dbDado ?? propio;
  if (!db) return <CargandoBloque />;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb debe usarse dentro de <DatosProvider>");
  return db;
}
