/**
 * El constructor de consultas: la misma API encadenable de supabase-js
 * (`from(t).select().eq()…`) que, al esperarse (thenable), se ejecuta contra
 * el almacén aplicando RLS, triggers y restricciones de reglas.ts.
 */
import { ESQUEMA, TABLAS, type Col, type Fila, type Tabla } from "./almacen";
import {
  ErrorBD,
  aPlano,
  dmlActualizar,
  dmlBorrar,
  dmlInsertar,
  dmlUpsert,
  filasVisibles,
  type Ctx,
  type ErrorPlano,
} from "./reglas";

export type Resultado = {
  data: unknown;
  error: ErrorPlano | null;
  count: number | null;
  status: number;
  statusText: string;
};

/** Lo que el cliente (index.ts) ofrece a los constructores: modos de red, latencia y contexto. */
export type Entorno = {
  correr: <R>(trabajo: (c: Ctx) => R | Promise<R>, fallo: (mensaje: string) => R, escritura: boolean) => Promise<R>;
};

export const estadoDeError = (e: ErrorPlano): number => {
  switch (e.code) {
    case "23505":
      return 409;
    case "23503":
      return 409;
    case "42501":
      return 403;
    case "PGRST116":
      return 406;
    case "PGRST205":
    case "PGRST202":
      return 404;
    default:
      return 400;
  }
};

export const resultadoDeFallo = (mensaje: string): Resultado => ({
  data: null,
  error: { message: mensaje, details: "", hint: "", code: "" },
  count: null,
  status: 0,
  statusText: "",
});

function resultadoDeError(e: unknown): Resultado {
  const error = aPlano(e);
  return { data: null, error, count: null, status: estadoDeError(error), statusText: "" };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

type Cond = { col: string; op: string; valor: unknown; negar: boolean };
type Tri = boolean | null;

const normal = (col: Col, v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  switch (col.tipo) {
    case "num":
    case "entero":
      return Number(v);
    case "ts":
      return Date.parse(String(v));
    case "bool":
      return v === true || v === "true";
    default:
      return String(v);
  }
};

const cmp = (a: unknown, b: unknown): number => (a === b ? 0 : (a as number) < (b as number) ? -1 : 1);

function evaluar(cond: Cond, col: Col, f: Fila): Tri {
  const a = normal(col, f[cond.col]);
  let r: Tri;
  if (cond.op === "is") {
    const v = cond.valor;
    r = v === null ? a === null : a === (v === true || v === "true") && a !== null;
  } else if (a === null) {
    r = null;
  } else if (cond.op === "in") {
    const lista = Array.isArray(cond.valor) ? cond.valor : [];
    r = lista.some((x) => normal(col, x) === a);
  } else {
    const b = normal(col, cond.valor);
    if (b === null) r = null;
    else
      switch (cond.op) {
        case "eq":
          r = a === b;
          break;
        case "neq":
          r = a !== b;
          break;
        case "gt":
          r = cmp(a, b) > 0;
          break;
        case "gte":
          r = cmp(a, b) >= 0;
          break;
        case "lt":
          r = cmp(a, b) < 0;
          break;
        case "lte":
          r = cmp(a, b) <= 0;
          break;
        default:
          throw new ErrorBD(`unknown operator "${cond.op}"`, "PGRST100");
      }
  }
  return cond.negar && r !== null ? !r : r;
}

function colDe(tabla: Tabla, nombre: string): Col {
  const col = ESQUEMA[tabla].cols[nombre];
  if (!col) throw new ErrorBD(`column ${tabla}.${nombre} does not exist`, "42703");
  return col;
}

// ---------------------------------------------------------------------------
// El constructor
// ---------------------------------------------------------------------------

type Orden = { col: string; asc: boolean; nullsFirst: boolean | undefined };
type Accion = "select" | "insert" | "update" | "delete" | "upsert";

export type OpcionesSelect = { count?: "exact" | "planned" | "estimated"; head?: boolean };
export type OpcionesUpsert = { onConflict?: string; ignoreDuplicates?: boolean; count?: string };

export class ConstructorConsulta implements PromiseLike<Resultado> {
  entorno: Entorno;
  tabla: string;
  accion: Accion = "select";
  columnas = "*";
  devolver = false;
  contar = false;
  cabeza = false;
  conds: Cond[] = [];
  orden: Orden[] = [];
  tope: number | null = null;
  desde: number | null = null;
  modo: "single" | "maybe" | null = null;
  carga: unknown = null;
  opcionesUpsert: OpcionesUpsert = {};
  promesa: Promise<Resultado> | null = null;

  constructor(entorno: Entorno, tabla: string) {
    this.entorno = entorno;
    this.tabla = tabla;
  }

  select(columnas?: string, opciones?: OpcionesSelect): this {
    this.columnas = columnas === undefined || columnas.trim() === "" ? "*" : columnas;
    if (this.accion !== "select") this.devolver = true;
    if (opciones?.count) this.contar = true;
    if (opciones?.head) this.cabeza = true;
    return this;
  }

  insert(carga: Fila | Fila[], _opciones?: { count?: string; defaultToNull?: boolean }): this {
    this.accion = "insert";
    this.carga = carga;
    return this;
  }

  upsert(carga: Fila | Fila[], opciones: OpcionesUpsert = {}): this {
    this.accion = "upsert";
    this.carga = carga;
    this.opcionesUpsert = opciones;
    return this;
  }

  update(parche: Fila, _opciones?: { count?: string }): this {
    this.accion = "update";
    this.carga = parche;
    return this;
  }

  delete(_opciones?: { count?: string }): this {
    this.accion = "delete";
    return this;
  }

  anadir(col: string, op: string, valor: unknown, negar = false): this {
    this.conds.push({ col, op, valor, negar });
    return this;
  }

  eq(col: string, valor: unknown): this {
    return this.anadir(col, "eq", valor);
  }
  neq(col: string, valor: unknown): this {
    return this.anadir(col, "neq", valor);
  }
  gt(col: string, valor: unknown): this {
    return this.anadir(col, "gt", valor);
  }
  gte(col: string, valor: unknown): this {
    return this.anadir(col, "gte", valor);
  }
  lt(col: string, valor: unknown): this {
    return this.anadir(col, "lt", valor);
  }
  lte(col: string, valor: unknown): this {
    return this.anadir(col, "lte", valor);
  }
  in(col: string, valores: unknown[]): this {
    return this.anadir(col, "in", valores);
  }
  is(col: string, valor: unknown): this {
    return this.anadir(col, "is", valor);
  }
  not(col: string, op: string, valor: unknown): this {
    return this.anadir(col, op, valor, true);
  }

  order(col: string, opciones?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orden.push({ col, asc: opciones?.ascending !== false, nullsFirst: opciones?.nullsFirst });
    return this;
  }

  limit(n: number): this {
    this.tope = n;
    return this;
  }

  range(desde: number, hasta: number): this {
    this.desde = desde;
    this.tope = hasta - desde + 1;
    return this;
  }

  single(): this {
    this.modo = "single";
    return this;
  }

  maybeSingle(): this {
    this.modo = "maybe";
    return this;
  }

  then<A = Resultado, B = never>(
    alCumplir?: ((valor: Resultado) => A | PromiseLike<A>) | null,
    alRechazar?: ((motivo: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    if (!this.promesa) {
      this.promesa = this.entorno.correr<Resultado>(
        (c) => this.ejecutar(c),
        resultadoDeFallo,
        this.accion !== "select",
      );
    }
    return this.promesa.then(alCumplir, alRechazar);
  }

  ejecutar(c: Ctx): Resultado {
    try {
      return this.ejecutarOrThrow(c);
    } catch (e) {
      return resultadoDeError(e);
    }
  }

  ejecutarOrThrow(c: Ctx): Resultado {
    if (!(TABLAS as readonly string[]).includes(this.tabla)) {
      throw new ErrorBD(`Could not find the table 'public.${this.tabla}' in the schema cache`, "PGRST205");
    }
    const tabla = this.tabla as Tabla;
    // Validar de antemano columnas de filtro y de orden (error 42703 como en Postgres).
    const colsFiltro = this.conds.map((k) => colDe(tabla, k.col));
    for (const o of this.orden) colDe(tabla, o.col);
    const proyeccion = this.proyeccion(tabla);
    const pasa = (f: Fila): boolean => this.conds.every((k, i) => evaluar(k, colsFiltro[i], f) === true);

    let filas: Fila[];
    let cuenta: number | null = null;
    let estado = 200;

    if (this.accion === "select") {
      filas = filasVisibles(c, tabla).filter(pasa);
      cuenta = this.contar ? filas.length : null;
      filas = this.ordenar(tabla, filas);
      if (this.desde !== null) filas = filas.slice(this.desde);
      if (this.tope !== null) filas = filas.slice(0, this.tope);
      if (this.cabeza) {
        return { data: null, error: null, count: cuenta, status: 200, statusText: "OK" };
      }
    } else {
      const devolver = this.devolver || this.modo !== null;
      switch (this.accion) {
        case "insert":
          filas = dmlInsertar(c, tabla, this.cargaFilas(), devolver);
          estado = 201;
          break;
        case "upsert": {
          const o = this.opcionesUpsert;
          const objetivo = o.onConflict ? o.onConflict.split(",").map((s) => s.trim()) : null;
          filas = dmlUpsert(c, tabla, this.cargaFilas(), objetivo, o.ignoreDuplicates === true, devolver);
          estado = 201;
          break;
        }
        case "update":
          filas = dmlActualizar(c, tabla, pasa, this.cargaFila(), devolver);
          break;
        default:
          filas = dmlBorrar(c, tabla, pasa, devolver);
          break;
      }
      if (!this.devolver && this.modo === null) {
        return { data: null, error: null, count: null, status: estado === 201 ? 201 : 204, statusText: "" };
      }
      filas = this.ordenar(tabla, filas);
      if (this.tope !== null) filas = filas.slice(0, this.tope);
    }

    const proyectadas = filas.map((f) => proyectar(f, proyeccion));
    if (this.modo !== null) {
      if (proyectadas.length === 1) {
        return { data: proyectadas[0], error: null, count: cuenta, status: estado, statusText: "OK" };
      }
      if (this.modo === "maybe" && proyectadas.length === 0) {
        return { data: null, error: null, count: cuenta, status: 200, statusText: "OK" };
      }
      const error: ErrorPlano = {
        message: "JSON object requested, multiple (or no) rows returned",
        code: "PGRST116",
        details: `The result contains ${proyectadas.length} rows`,
        hint: null,
      };
      return { data: null, error, count: null, status: 406, statusText: "Not Acceptable" };
    }
    return { data: proyectadas, error: null, count: cuenta, status: estado, statusText: "OK" };
  }

  cargaFilas(): Fila[] {
    const k = this.carga;
    const lista = Array.isArray(k) ? k : [k];
    for (const x of lista) {
      if (typeof x !== "object" || x === null || Array.isArray(x)) {
        throw new ErrorBD("Empty or invalid json", "PGRST102");
      }
    }
    return lista as Fila[];
  }

  cargaFila(): Fila {
    const k = this.carga;
    if (typeof k !== "object" || k === null || Array.isArray(k)) throw new ErrorBD("Empty or invalid json", "PGRST102");
    return k as Fila;
  }

  proyeccion(tabla: Tabla): string[] | null {
    if (this.columnas.trim() === "*") return null;
    if (this.columnas.includes("(")) {
      throw new ErrorBD(
        `Could not find a relationship between '${tabla}' and the requested table in the schema cache`,
        "PGRST200",
        "Las relaciones embebidas no están soportadas por la base en memoria.",
      );
    }
    const nombres = this.columnas.split(",").map((s) => s.trim()).filter((s) => s !== "");
    for (const n of nombres) if (n !== "*") colDe(tabla, n);
    return nombres.includes("*") ? null : nombres;
  }

  ordenar(tabla: Tabla, filas: Fila[]): Fila[] {
    if (this.orden.length === 0) return filas;
    const cols = this.orden.map((o) => colDe(tabla, o.col));
    return filas
      .map((f, i) => ({ f, i }))
      .sort((x, y) => {
        for (let k = 0; k < this.orden.length; k++) {
          const o = this.orden[k];
          const a = normal(cols[k], x.f[o.col]);
          const b = normal(cols[k], y.f[o.col]);
          if (a === b) continue;
          // Postgres: ASC => NULL al final; DESC => NULL al principio (salvo nullsFirst explícito).
          const nulosPrimero = o.nullsFirst ?? !o.asc;
          if (a === null) return nulosPrimero ? -1 : 1;
          if (b === null) return nulosPrimero ? 1 : -1;
          const r = cmp(a, b);
          if (r !== 0) return o.asc ? r : -r;
        }
        return x.i - y.i;
      })
      .map((p) => p.f);
  }
}

function proyectar(f: Fila, cols: string[] | null): Fila {
  if (cols === null) return { ...f };
  const r: Fila = {};
  for (const c of cols) r[c] = f[c];
  return r;
}
