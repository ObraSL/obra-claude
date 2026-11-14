"use client";

import { useEffect } from "react";

/** Registra el service worker para que el navegador ofrezca instalar la app (PLT-02). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin soporte: la app funciona igual, solo que no se puede instalar.
      });
    }
  }, []);

  return null;
}
