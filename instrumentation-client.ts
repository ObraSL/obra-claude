import { reportarError } from "@/lib/errores";

// Fallos del navegador que nadie ha capturado: se guardan para verlos en
// /admin (Fase 4, punto 24). Los que pinta React los recoge app/error.tsx.
window.addEventListener("error", (ev) => {
  reportarError(ev.error ?? ev.message, ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined);
});
window.addEventListener("unhandledrejection", (ev) => {
  reportarError(ev.reason, "promesa sin capturar");
});
