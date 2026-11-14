import { createElement, Fragment, type ReactNode } from "react";
import { uk } from "./uk";
import { en } from "./en";

/**
 * Idiomas de la app. El texto se escribe en español directamente en el
 * código, envuelto en tr("..."): ese mismo texto es la clave para buscar la
 * traducción en uk.ts / en.ts. Si falta una traducción, sale en español
 * (nunca una clave rara ni un hueco vacío).
 *
 * El idioma actual vive en una variable de módulo (no en un hook) para
 * poder traducir también fuera de los componentes (lib/nav.ts, etiquetas
 * de rol, formatos de fecha…). Cuando cambia, IdiomaProvider vuelve a
 * montar toda la app, así que todo se repinta en el idioma nuevo.
 */
export type Idioma = "es" | "uk" | "en";

export const IDIOMAS: { id: Idioma; nombre: string; corto: string }[] = [
  { id: "es", nombre: "Español", corto: "ES" },
  { id: "uk", nombre: "Українська", corto: "UA" },
  { id: "en", nombre: "English", corto: "EN" },
];

export const COOKIE_IDIOMA = "idioma";

const DICCIONARIOS: Record<Exclude<Idioma, "es">, Record<string, string>> = { uk, en };
const LOCALES: Record<Idioma, string> = { es: "es-ES", uk: "uk-UA", en: "en-GB" };

let actual: Idioma = "es";

export const fijarIdioma = (i: Idioma) => {
  actual = i;
};
export const idiomaActual = () => actual;
/** Para toLocaleDateString / Intl.NumberFormat. */
export const localeActual = () => LOCALES[actual];

export const esIdioma = (v: unknown): v is Idioma => v === "es" || v === "uk" || v === "en";

/** Elige idioma a partir de la lista de idiomas del teléfono/navegador. */
export function idiomaDesde(preferidos: readonly string[]): Idioma {
  for (const p of preferidos) {
    const base = p.toLowerCase().split(/[-_;]/)[0].trim();
    if (base === "uk" || base === "ru") return "uk";
    if (base === "es" || base === "ca" || base === "gl" || base === "eu") return "es";
    if (base === "en") return "en";
  }
  return "es";
}

/** Traduce un texto en español. Admite huecos tipo {nombre}. */
export function tr(texto: string, vars?: Record<string, string | number>): string {
  let s = actual === "es" ? texto : (DICCIONARIOS[actual][texto] ?? texto);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/**
 * Como tr(), pero los huecos pueden ser trozos de JSX (un <span> en
 * negrita, un importe…): la frase se traduce entera y los trozos se meten
 * en su sitio, así cada idioma puede ordenar la frase a su manera.
 */
export function trJsx(texto: string, vars: Record<string, ReactNode>): ReactNode {
  const traducido = tr(texto);
  return traducido.split(/(\{\w+\})/).map((trozo, i) => {
    const m = trozo.match(/^\{(\w+)\}$/);
    return createElement(Fragment, { key: i }, m && m[1] in vars ? vars[m[1]] : trozo);
  });
}

/**
 * Frases con número: trN(n, "{n} día", "{n} días"). En ucraniano hay tres
 * formas (1 день / 2 дні / 5 днів): en uk.ts la clave del plural lleva
 * las tres separadas por "|".
 */
export function trN(n: number, uno: string, varios: string): string {
  if (actual === "uk") {
    const formas = (DICCIONARIOS.uk[varios] ?? "").split("|");
    if (formas.length === 3) {
      const d = Math.abs(n) % 10;
      const dd = Math.abs(n) % 100;
      const f = d === 1 && dd !== 11 ? 0 : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 1 : 2;
      return formas[f].split("{n}").join(String(n));
    }
  }
  return tr(n === 1 ? uno : varios, { n });
}
