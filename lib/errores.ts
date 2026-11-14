import { createClient } from "@/lib/supabase/client";

/**
 * Manda un fallo del navegador a la tabla errores_app (ver
 * supabase/migracion-errores.sql). Nunca lanza nada: si ni siquiera se
 * puede avisar del error, se deja estar — lo último que queremos es que el
 * aviso de un error provoque otro.
 */
const enviados = new Set<string>();
const MAX_POR_PAGINA = 20;

export function reportarError(error: unknown, extra?: string) {
  try {
    const e = error instanceof Error ? error : null;
    const mensaje = (e?.message ?? String(error ?? "")).slice(0, 500) || "(sin mensaje)";
    // Ruido del navegador que no dice nada de la app.
    if (/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch|NetworkError/i.test(mensaje)) return;

    const clave = mensaje + (e?.stack?.slice(0, 200) ?? "");
    if (enviados.has(clave) || enviados.size >= MAX_POR_PAGINA) return;
    enviados.add(clave);

    const digest = e && "digest" in e ? ` [digest ${(e as { digest?: string }).digest}]` : "";
    void createClient()
      .rpc("registrar_error", {
        p_origen: "navegador",
        p_mensaje: mensaje + digest,
        p_detalle: [extra, e?.stack].filter(Boolean).join("\n").slice(0, 4000) || null,
        p_ruta: typeof location !== "undefined" ? location.pathname + location.search : null,
        p_navegador: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .then(
        () => undefined,
        () => undefined
      );
  } catch {
    /* nada */
  }
}
