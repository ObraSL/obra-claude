import type { WorkBook, WorkSheet, CellObject } from "xlsx";
import * as XLSX from "xlsx";
import { tr } from "@/lib/i18n";

/**
 * Lectura de un Gantt hecho en Excel.
 *
 * Los Gantt de obra no guardan fechas: se dibujan PINTANDO celdas. Arriba
 * hay una fila de columnas por semana y cada trabajo tiene coloreadas las
 * semanas en las que se hace. O sea que las fechas hay que sacarlas del
 * color, no de ningún texto.
 *
 * Se empezó con el archivo de un cliente ("Gant Banus.xlsx") y el punto 20
 * del plan (30/09/2026) lo abrió a otros formatos parecidos:
 *
 *   - Semanas: texto tipo "WEEK 1 16.03-20.03" / "Semana 1 16/03-20/03", o
 *     directamente una fecha de verdad en la celda (el lunes de la semana).
 *   - Capítulos: filas que empiezan por РОЗДІЛ / CHAPTER / CAPÍTULO / FASE /
 *     PARTIDA / ZONA…, o con un número solo ("1", "02") y un nombre al lado.
 *     Si el Excel no tiene capítulos, cada trabajo pasa a ser una tarea.
 *   - Trabajos: código tipo "01.02" o "1.1" en la primera columna y nombre
 *     al lado.
 *   - Importe: la columna que se llame AMOUNT / IMPORTE / TOTAL / PRESUPUESTO
 *     / СУМА, en la misma fila del trabajo o en la de debajo (el de Banus lo
 *     pone abajo, en la fila de la descripción larga). Sin esa cabecera, la
 *     5ª columna, como en Banus.
 *
 * La plantilla de /public/plantilla-plan-obra.xlsx sigue exactamente esto.
 */

/** Una sección del Excel ya convertida en tarea del plan. */
export type SeccionImportada = {
  nombre: string;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  presupuesto: number; // suma de los importes de sus trabajos
  lineas: number; // cuántos trabajos la componen
};

export type ResultadoImport = {
  secciones: SeccionImportada[];
  hoja: string;
  semanas: number;
  anio: number;
  totalPresupuesto: number;
  avisos: string[];
};

/** "WEEK 3 30.03-3.04" o "16/03-20/03" → los dos días. Aguanta la errata "12-06" por "12.06". */
const RE_SEMANA = /(\d{1,2})\s*[.,/-]\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[.,/-]\s*(\d{1,2})/;
const RE_CAPITULO = /^(РОЗДІЛ|РАЗДЕЛ|CHAPTER|SECTION|PHASE|CAP[ÍI]TULO|SECCI[ÓO]N|FASE|PARTIDA|ZONA|BLOQUE)(?=[\s:.\-\d]|$)/i;
const RE_CODIGO_TRABAJO = /^\d+([.,]\d+)+\.?$/;
const RE_CODIGO_CAPITULO = /^\d{1,3}\.?$/;
const RE_COL_IMPORTE = /^(AMOUNT|TOTAL|IMPORTE|PRESUPUESTO|СУМА|ВАРТІСТЬ)/i;

const dosDig = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`;

const celda = (ws: WorkSheet, fila: number, col: number) =>
  ws[XLSX.utils.encode_cell({ r: fila, c: col })] as CellObject | undefined;

const texto = (ws: WorkSheet, fila: number, col: number): string => {
  const c = celda(ws, fila, col);
  return c && c.v != null ? String(c.v).replace(/\s+/g, " ").trim() : "";
};

const numero = (ws: WorkSheet, fila: number, col: number): number => {
  const v = celda(ws, fila, col)?.v;
  return typeof v === "number" ? v : 0;
};

/** Fecha de una celda con fecha de Excel (número con formato de fecha). */
function fechaDeCelda(c: CellObject | undefined): Date | null {
  if (!c) return null;
  if (c.v instanceof Date) return c.v;
  if (c.t === "n" && typeof c.v === "number" && typeof c.z === "string" && /[dmy]/i.test(c.z) && !/h|s/i.test(c.z)) {
    const p = XLSX.SSF.parse_date_code(c.v);
    if (p) return new Date(p.y, p.m - 1, p.d);
  }
  return null;
}

/**
 * ¿Está pintada esta celda? Es lo que marca que el trabajo se hace esa
 * semana. Se descarta el blanco: pintar de blanco es no pintar. (Los
 * colores de la paleta del tema ya llegan convertidos a rgb.)
 */
function estaPintada(ws: WorkSheet, fila: number, col: number): boolean {
  const c = celda(ws, fila, col) as
    | (CellObject & { s?: { fgColor?: { rgb?: string }; patternType?: string } })
    | undefined;
  if (c?.s?.patternType === "none") return false;
  const rgb = c?.s?.fgColor?.rgb;
  if (!rgb) return false;
  const limpio = rgb.length === 8 ? rgb.slice(2) : rgb; // puede venir con alfa
  return limpio.toUpperCase() !== "FFFFFF";
}

/** Una semana ya con fechas, o todavía sin año si venía como texto. */
type Semana =
  | { col: number; tipo: "texto"; dia1: number; mes1: number; dia2: number; mes2: number }
  | { col: number; tipo: "fecha"; desde: Date };

/** Busca la hoja y la fila donde están las cabeceras de semana. */
function localizarSemanas(wb: WorkBook) {
  for (const nombreHoja of wb.SheetNames) {
    const ws = wb.Sheets[nombreHoja];
    if (!ws?.["!ref"]) continue;
    const rango = XLSX.utils.decode_range(ws["!ref"]);

    // La cabecera suele estar arriba del todo; con mirar 30 filas sobra.
    for (let f = rango.s.r; f <= Math.min(rango.e.r, rango.s.r + 30); f++) {
      const semanas: Semana[] = [];
      for (let c = rango.s.c; c <= rango.e.c; c++) {
        const m = texto(ws, f, c).match(RE_SEMANA);
        const fecha = fechaDeCelda(celda(ws, f, c));
        if (m) {
          semanas.push({ col: c, tipo: "texto", dia1: +m[1], mes1: +m[2], dia2: +m[3], mes2: +m[4] });
        } else if (fecha) {
          semanas.push({ col: c, tipo: "fecha", desde: fecha });
        }
      }
      // Dos columnas con forma de semana ya no es casualidad.
      if (semanas.length >= 2) return { hoja: nombreHoja, ws, filaCabecera: f, semanas };
    }
  }
  return null;
}

/**
 * El Excel no guarda el año (cuando las semanas vienen como texto). Se
 * prueban varios y se elige aquel en el que la primera semana empieza en
 * lunes, que es como se montan estos planes. Si ninguno cuadra, el actual.
 */
export function adivinarAnio(semanas: Semana[], hoy = new Date()): number {
  const primera = semanas[0];
  if (primera.tipo === "fecha") return primera.desde.getFullYear();
  const actual = hoy.getFullYear();
  for (const anio of [actual, actual + 1, actual - 1, actual + 2, actual - 2]) {
    const d = new Date(anio, primera.mes1 - 1, primera.dia1);
    if (d.getDay() === 1) return anio;
  }
  return actual;
}

/** Pone fechas completas a cada semana. */
function fecharSemanas(semanas: Semana[], anio: number) {
  let anioActual = anio;
  let mesAnterior: number | null = null;

  return semanas.map((s, i) => {
    if (s.tipo === "fecha") {
      // Hasta el día antes de la semana siguiente (o 4 días: de lunes a viernes).
      const sig = semanas[i + 1];
      const fin = new Date(s.desde);
      if (sig?.tipo === "fecha" && sig.desde > s.desde) fin.setTime(sig.desde.getTime() - 86_400_000);
      else fin.setDate(fin.getDate() + 4);
      return { col: s.col, desde: iso(s.desde), hasta: iso(fin) };
    }
    // Cuando el mes baja, es que cambió de año.
    if (mesAnterior != null && s.mes1 < mesAnterior) anioActual++;
    mesAnterior = s.mes1;
    const desde = `${anioActual}-${dosDig(s.mes1)}-${dosDig(s.dia1)}`;
    // Una semana puede cruzar el fin de año (30.12 – 3.01)
    const anioFin = s.mes2 < s.mes1 ? anioActual + 1 : anioActual;
    if (s.mes2 < mesAnterior) mesAnterior = s.mes2;
    const hasta = `${anioFin}-${dosDig(s.mes2)}-${dosDig(s.dia2)}`;
    return { col: s.col, desde, hasta };
  });
}

/**
 * Lee el plan del libro de Excel. Si no se dice el año, se adivina por el
 * día de la semana.
 */
export function leerPlanExcel(wb: WorkBook, anioForzado?: number): ResultadoImport {
  const encontrado = localizarSemanas(wb);
  if (!encontrado) {
    throw new Error(
      tr("No he encontrado la fila de semanas. Se esperan columnas tipo «WEEK 1 16.03-20.03».")
    );
  }

  const { hoja, ws, filaCabecera, semanas } = encontrado;
  const anio = anioForzado ?? adivinarAnio(semanas);
  const fechadas = fecharSemanas(semanas, anio);
  const colsSemana = new Set(fechadas.map((s) => s.col));
  const avisos: string[] = [];
  const rango = XLSX.utils.decode_range(ws["!ref"]!);

  // Columna del importe: por su cabecera; si no hay, la 5ª (como en Banus).
  let colImporte = 4;
  for (let c = rango.s.c; c <= rango.e.c; c++) {
    if (!colsSemana.has(c) && RE_COL_IMPORTE.test(texto(ws, filaCabecera, c))) {
      colImporte = c;
      break;
    }
  }

  // Primero se leen todos los trabajos con su capítulo; luego se agrupa.
  type Linea = { capitulo: string | null; nombre: string; desde: string | null; hasta: string | null; euros: number };
  const lineas: Linea[] = [];
  let capitulo: string | null = null;

  // Se empieza por arriba del todo, no después de la cabecera: la primera
  // sección suele ir JUSTO ENCIMA de la fila de semanas, y si se empieza
  // debajo se pierde el primer capítulo entero.
  for (let f = rango.s.r; f <= rango.e.r; f++) {
    if (f === filaCabecera) continue;
    const a = texto(ws, f, 0);
    const b = texto(ws, f, 1);

    // Las filas "TOTAL CHAPTER 01" son sumas, no capítulos nuevos.
    if (/^TOTAL/i.test(a)) continue;
    if (RE_CAPITULO.test(a)) {
      capitulo = a;
      continue;
    }
    if (RE_CODIGO_CAPITULO.test(a) && b) {
      capitulo = `${a.replace(/\.$/, "")}. ${b}`;
      continue;
    }

    if (RE_CODIGO_TRABAJO.test(a) && b) {
      const pintadas = fechadas.filter((s) => estaPintada(ws, f, s.col));
      // El importe, en la misma fila o, si ahí no hay, en la de abajo (que no
      // sea ya otro trabajo).
      let euros = numero(ws, f, colImporte);
      if (!euros && !RE_CODIGO_TRABAJO.test(texto(ws, f + 1, 0))) euros = numero(ws, f + 1, colImporte);
      lineas.push({
        capitulo,
        nombre: b,
        desde: pintadas[0]?.desde ?? null,
        hasta: pintadas[pintadas.length - 1]?.hasta ?? null,
        euros,
      });
    }
  }

  // Con capítulos, cada capítulo es una tarea; sin ninguno, cada trabajo.
  const hayCapitulos = lineas.some((l) => l.capitulo);
  const grupos = new Map<string, Linea[]>();
  for (const l of lineas) {
    const clave = hayCapitulos ? (l.capitulo ?? tr("Sin capítulo")) : l.nombre;
    grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
  }

  const secciones: SeccionImportada[] = [];
  for (const [nombre, ls] of grupos) {
    const desdes = ls.map((l) => l.desde).filter((x): x is string => !!x).sort();
    const hastas = ls.map((l) => l.hasta).filter((x): x is string => !!x).sort();
    if (desdes.length === 0) {
      avisos.push(tr("«{nombre}» no tiene ninguna semana pintada, se ha dejado fuera.", { nombre }));
      continue;
    }
    secciones.push({
      nombre,
      fecha_inicio: desdes[0],
      fecha_fin: hastas[hastas.length - 1],
      presupuesto: Math.round(ls.reduce((s, l) => s + l.euros, 0) * 100) / 100,
      lineas: ls.length,
    });
  }

  if (secciones.length === 0) {
    throw new Error(
      tr("He leído la hoja pero no he encontrado capítulos con semanas pintadas. Revisa que el Gantt tenga las celdas coloreadas.")
    );
  }

  return {
    secciones,
    hoja,
    semanas: semanas.length,
    anio,
    totalPresupuesto: Math.round(secciones.reduce((s, x) => s + x.presupuesto, 0) * 100) / 100,
    avisos,
  };
}

/** Lee un archivo elegido en el móvil o el ordenador. */
export async function leerArchivoExcel(
  archivo: File,
  anioForzado?: number
): Promise<ResultadoImport> {
  const datos = await archivo.arrayBuffer();
  // cellStyles hace falta sí o sí: sin los colores no hay fechas.
  const wb = XLSX.read(datos, { cellStyles: true, sheetStubs: true });
  return leerPlanExcel(wb, anioForzado);
}
