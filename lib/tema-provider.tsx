"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { COLOR_BARRA, COOKIE_TEMA, type Tema } from "./tema";

const TemaContext = createContext<{ tema: Tema; cambiarTema: (t: Tema) => void } | null>(null);

export function TemaProvider({ inicial, children }: { inicial: Tema; children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(inicial);

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "claro") raiz.dataset.tema = "claro";
    else delete raiz.dataset.tema;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR_BARRA[tema]);
  }, [tema]);

  const cambiarTema = useCallback((t: Tema) => {
    document.cookie = `${COOKIE_TEMA}=${t}; path=/; max-age=31536000; samesite=lax`;
    setTema(t);
  }, []);

  return <TemaContext.Provider value={{ tema, cambiarTema }}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema debe usarse dentro de <TemaProvider>");
  return ctx;
}
