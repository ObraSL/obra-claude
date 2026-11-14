/**
 * Tema visual (DECISIONES D-06): «salvia» (el de la referencia, por defecto)
 * o «claro» (para pleno sol). Se guarda en una cookie, como el idioma, para
 * que el servidor pinte ya el tema correcto en la primera carga, sin parpadeo.
 * Este archivo lo usan servidor y cliente; el proveedor está en tema-provider.tsx.
 */
export type Tema = "salvia" | "claro";

export const COOKIE_TEMA = "tema";
export const esTema = (v: unknown): v is Tema => v === "salvia" || v === "claro";

/** Color de la barra de estado del móvil para cada tema (= color del lienzo). */
export const COLOR_BARRA: Record<Tema, string> = { salvia: "#6b7867", claro: "#eef1ea" };
