"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useDb } from "@/lib/datos/provider";

/** Sesión en el cliente, con estado de carga (igual que v1, sobre la capa de datos). */
export function useSession() {
  const db = useDb();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    db.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = db.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [db]);

  return { session, loading };
}
