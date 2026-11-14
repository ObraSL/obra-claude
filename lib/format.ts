import { localeActual } from "@/lib/i18n";

/**
 * Fechas en formato "YYYY-MM-DD" según la hora DE AQUÍ, no la de Greenwich.
 *
 * Ojo con esto, que ya nos costó un error feo: `toISOString()` convierte a
 * hora UTC. En España (UTC+1 / UTC+2) eso resta una o dos horas, así que
 * una fecha a las 00:00 se convertía en el día ANTERIOR. Resultado: el
 * botón de "día siguiente" no hacía nada y el de "día anterior" saltaba de
 * dos en dos (7 → 5 → 3). Por eso aquí se arma la cadena a mano.
 */
const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayStr = () => aISO(new Date());

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const fmtDateLong = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const s = d.toLocaleDateString(localeActual(), { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fmtEUR = (n: number | string | null | undefined) =>
  new Intl.NumberFormat(localeActual(), { style: "currency", currency: "EUR" }).format(Number(n) || 0);

/** Euros sin céntimos, para cifras que tienen que caber en poco sitio. */
export const fmtEURCorto = (n: number | string | null | undefined) =>
  new Intl.NumberFormat(localeActual(), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const currentMonth = () => todayStr().slice(0, 7);

export const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString(localeActual(), { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const shiftMonth = (iso: string, delta: number) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Límites [desde, hasta) de un mes "YYYY-MM" para filtrar fechas en Postgres
 * con gte/lt. Ojo: un truco como `${mes}-32` NO sirve aquí — Postgres valida
 * el literal como fecha real y lo rechaza (error 400), a diferencia de una
 * comparación de strings en JS.
 */
export const monthBounds = (mes: string) => ({
  desde: `${mes}-01`,
  hasta: `${shiftMonth(mes, 1)}-01`,
});

/** Suma (o resta) días a una fecha "YYYY-MM-DD". Salta bien los cambios de mes. */
export const shiftDay = (iso: string, delta: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return aISO(new Date(y, m - 1, d + delta));
};

export const weekdayShort = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const s = d.toLocaleDateString(localeActual(), { weekday: "short", day: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
