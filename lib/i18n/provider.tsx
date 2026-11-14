"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useState } from "react";
import { COOKIE_IDIOMA, fijarIdioma, type Idioma } from "./index";

const IdiomaContext = createContext<{ idioma: Idioma; cambiarIdioma: (i: Idioma) => void } | null>(null);

/**
 * El idioma inicial lo decide el servidor (cookie guardada, o si no, el
 * idioma del teléfono), así la primera pantalla ya sale bien, sin parpadeo.
 */
export function IdiomaProvider({ inicial, children }: { inicial: Idioma; children: React.ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(inicial);
  // Antes de pintar a los hijos: t() lee esta variable.
  fijarIdioma(idioma);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  const cambiarIdioma = useCallback((i: Idioma) => {
    document.cookie = `${COOKIE_IDIOMA}=${i}; path=/; max-age=31536000; samesite=lax`;
    setIdioma(i);
  }, []);

  return (
    <IdiomaContext.Provider value={{ idioma, cambiarIdioma }}>
      {/* key: al cambiar de idioma se vuelve a montar todo y se repinta traducido. */}
      <Fragment key={idioma}>{children}</Fragment>
    </IdiomaContext.Provider>
  );
}

export function useIdioma() {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error("useIdioma debe usarse dentro de <IdiomaProvider>");
  return ctx;
}
