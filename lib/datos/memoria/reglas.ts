/**
 * Las reglas de la base de datos de v1 sobre el almacén en memoria:
 *  - identidad (quién soy, de qué empresa, con qué rol) como las funciones SQL
 *    mi_rol(), mi_empresa_id()…
 *  - RLS por tabla y operación (sección 3 de D-base-de-datos.md)
 *  - triggers (fichajes, gastos) con los textos de error EXACTOS
 *  - restricciones: NOT NULL, CHECK, UNIQUE, claves foráneas (RESTRICT / SET NULL)
 *  - operaciones DML atómicas (insertar, actualizar, borrar, upsert)
 */
import {
  ESQUEMA,
  RE_UUID,
  madrid,
  rellenarFila,
  uuid,
  type Almacen,
  type Col,
  type DefectoEspecial,
  type Fila,
  type Tabla,
} from "./almacen";

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Error de base de datos: lo que Postgres/PostgREST devolverían en `error`. */
export class ErrorBD extends Error {
  code: string | undefined;
  details: string | null;
  hint: string | null;
  constructor(message: string, code?: string, details?: string | null, hint?: string | null) {
    super(message);
    this.name = "ErrorBD";
    this.code = code;
    this.details = details ?? null;
    this.hint = hint ?? null;
  }
}

export type ErrorPlano = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function aPlano(e: unknown): ErrorPlano {
  if (e instanceof ErrorBD) {
    const r: ErrorPlano = { message: e.message, details: e.details, hint: e.hint };
    if (e.code) r.code = e.code;
    return r;
  }
  return { message: e instanceof Error ? `Error interno de la base en memoria: ${e.message}` : String(e) };
}

/** `raise exception '...'` de plpgsql (SQLSTATE P0001). */
export const excepcion = (mensaje: string) => new ErrorBD(mensaje, "P0001");

// ---------------------------------------------------------------------------
// Contexto de una operación
// ---------------------------------------------------------------------------

export type Identidad = {
  rol: string | null;
  empresaId: string | null;
  trabajadorId: string | null;
  obraId: string | null;
};

export type Ctx = {
  almacen: Almacen;
  /** Instante "now()" de la operación (reloj inyectable). */
  ahora: Date;
  /** auth.uid(): null = anónimo. */
  uid: string | null;
  _ident?: Identidad;
};

export function crearCtx(almacen: Almacen, ahora: Date, uid?: string | null): Ctx {
  return { almacen, ahora, uid: uid !== undefined ? uid : (almacen.sesion?.user_id ?? null) };
}

const tab = (c: Ctx, t: Tabla) => c.almacen.tablas[t];
const igual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
const ms = (v: unknown) => Date.parse(String(v));

/** Fila de miembros con "pertenencia válida" (sección 2 de D). */
function miembroValido(c: Ctx): Fila | null {
  if (!c.uid) return null;
  const m = tab(c, "miembros").find((x) => x.user_id === c.uid);
  if (!m || !m.aprobado) return null;
  const ahora = c.ahora.getTime();
  if (m.es_soporte) {
    const hayAcceso = tab(c, "soporte_accesos").some(
      (s) =>
        s.empresa_id === m.empresa_id &&
        s.otorgado_a === m.user_id &&
        s.revocado_en == null &&
        ms(s.expira_en) > ahora,
    );
    if (!hayAcceso) return null;
  }
  const e = tab(c, "empresas").find((x) => x.id === m.empresa_id);
  if (!e || e.bloqueada) return null;
  if (e.activa_hasta != null && ms(e.activa_hasta) <= ahora) return null;
  return m;
}

export function identidad(c: Ctx): Identidad {
  if (c._ident) return c._ident;
  const valido = miembroValido(c);
  const propio = c.uid ? tab(c, "miembros").find((x) => x.user_id === c.uid && x.aprobado) : undefined;
  const id: Identidad = {
    rol: valido ? (valido.rol as string) : null,
    empresaId: valido ? (valido.empresa_id as string) : null,
    // mi_trabajador_id() y mi_obra_id() no miran caducidad.
    trabajadorId: propio ? ((propio.trabajador_id as string | null) ?? null) : null,
    obraId: propio ? ((propio.obra_id as string | null) ?? null) : null,
  };
  c._ident = id;
  return id;
}

export const miRol = (c: Ctx) => identidad(c).rol;
export const miEmpresaId = (c: Ctx) => identidad(c).empresaId;

export function empresaPorDefecto(a: Almacen): string | null {
  let mejor: Fila | null = null;
  for (const e of a.tablas.empresas) {
    if (!mejor || ms(e.created_at) < ms(mejor.created_at)) mejor = e;
  }
  return mejor ? (mejor.id as string) : null;
}

/** owner_empresa(): el dueño aprobado más antiguo de mi empresa. */
export function ownerEmpresa(c: Ctx): string | null {
  const emp = miEmpresaId(c);
  if (!emp) return null;
  let mejor: Fila | null = null;
  for (const m of tab(c, "miembros")) {
    if (m.rol !== "dueno" || !m.aprobado || m.empresa_id !== emp) continue;
    if (!mejor || ms(m.created_at) < ms(mejor.created_at)) mejor = m;
  }
  return mejor ? (mejor.user_id as string) : null;
}

/** jefe_ve_todas de mi empresa (subconsulta escalar: dos filas = error, como en SQL). */
export function jefeVeTodas(c: Ctx): boolean {
  const emp = miEmpresaId(c);
  const filas = tab(c, "ajustes").filter((a) => emp !== null && a.empresa_id === emp);
  if (filas.length > 1) {
    throw new ErrorBD("more than one row returned by a subquery used as an expression", "21000");
  }
  return filas.length === 1 ? filas[0].jefe_ve_todas === true : false;
}

export function puedeVerObra(c: Ctx, obraId: unknown): boolean {
  const i = identidad(c);
  const obra = tab(c, "obras").find((o) => o.id === obraId);
  if (!obra || i.empresaId === null || obra.empresa_id !== i.empresaId) return false;
  switch (i.rol) {
    case "dueno":
    case "manager":
    case "trabajador":
      return true;
    case "jefe_obra":
      return obraId === i.obraId || jefeVeTodas(c);
    default:
      return false;
  }
}

export function puedeGestionarObra(c: Ctx, obraId: unknown): boolean {
  const i = identidad(c);
  const obra = tab(c, "obras").find((o) => o.id === obraId);
  if (!obra || i.empresaId === null || obra.empresa_id !== i.empresaId) return false;
  switch (i.rol) {
    case "dueno":
    case "manager":
      return true;
    case "jefe_obra":
      return obraId === i.obraId || jefeVeTodas(c);
    default:
      return false;
  }
}

export function soyAdmin(c: Ctx): boolean {
  return c.uid !== null && tab(c, "admins_plataforma").some((a) => a.user_id === c.uid);
}

// ---------------------------------------------------------------------------
// RLS
// ---------------------------------------------------------------------------

export type Op = "select" | "insert" | "update" | "delete";

/** ¿Deja el RLS hacer `op` sobre esta fila? (USING para select/delete, CHECK para insert, ambos para update). */
export function politica(c: Ctx, tabla: Tabla, op: Op, f: Fila): boolean {
  const i = identidad(c);
  const rol = i.rol;
  const miEmpresa = i.empresaId !== null && f.empresa_id === i.empresaId;
  const dm = rol === "dueno" || rol === "manager";
  const gest = () => puedeGestionarObra(c, f.obra_id);

  switch (tabla) {
    case "empresas": {
      if (op !== "select" || !c.uid) return false;
      const m = tab(c, "miembros").find((x) => x.user_id === c.uid);
      return !!m && m.aprobado === true && m.empresa_id === f.id;
    }
    case "miembros": {
      if (rol === "dueno" && i.empresaId !== null && f.empresa_id === i.empresaId) return true;
      return op === "select" && c.uid !== null && f.user_id === c.uid;
    }
    case "obras":
      if (op === "select") return puedeVerObra(c, f.id);
      return dm && miEmpresa;
    case "trabajadores":
      if (op === "select") return rol !== null && miEmpresa;
      return dm && miEmpresa;
    case "vehiculos":
      if (op === "select") return rol !== null && miEmpresa;
      return dm && miEmpresa;
    case "fichajes": {
      if (gest()) return true;
      if (op === "delete") return false;
      return (
        rol === "trabajador" &&
        i.trabajadorId !== null &&
        f.trabajador_id === i.trabajadorId &&
        puedeVerObra(c, f.obra_id)
      );
    }
    case "fichajes_historial": {
      if (op !== "select") return false;
      if (gest()) return true;
      return (
        rol === "trabajador" &&
        i.trabajadorId !== null &&
        f.trabajador_id === i.trabajadorId &&
        puedeVerObra(c, f.obra_id)
      );
    }
    case "usos_vehiculo":
      if (gest()) return true;
      return op === "select" && rol === "trabajador" && puedeVerObra(c, f.obra_id);
    case "gastos":
    case "facturas":
    case "tareas":
    case "notas_audio":
      return gest();
    case "proveedores":
      return (rol === "dueno" || rol === "manager" || rol === "jefe_obra") && miEmpresa;
    case "cobros":
      return dm && gest();
    case "entregas":
      return rol === "dueno" && miEmpresa;
    case "ajustes":
      if (op === "select") return rol !== null && miEmpresa;
      return rol === "dueno" && c.uid !== null && f.owner_id === c.uid;
    case "soporte_accesos":
      return op === "select" && rol === "dueno" && miEmpresa;
    default:
      return false; // admins_plataforma, codigos_alta, errores_app: solo por RPC
  }
}

const errorRls = (tabla: Tabla) =>
  new ErrorBD(`new row violates row-level security policy for table "${tabla}"`, "42501");

/** Filas que el usuario actual puede ver (RLS de SELECT). Devuelve las filas reales, no copias. */
export function filasVisibles(c: Ctx, tabla: Tabla): Fila[] {
  return tab(c, tabla).filter((f) => politica(c, tabla, "select", f));
}

// ---------------------------------------------------------------------------
// Restricciones
// ---------------------------------------------------------------------------

type Unica = { nombre: string; cols: string[]; etiqueta?: string; clave?: (f: Fila) => unknown[] };

const UNICAS: Partial<Record<Tabla, Unica[]>> = {
  empresas: [{ nombre: "empresas_codigo_key", cols: ["codigo"] }],
  codigos_alta: [
    { nombre: "codigos_alta_codigo_key", cols: ["codigo"] },
    { nombre: "codigos_alta_stripe_session_id_key", cols: ["stripe_session_id"] },
  ],
  fichajes: [{ nombre: "fichajes_obra_id_trabajador_id_fecha_key", cols: ["obra_id", "trabajador_id", "fecha"] }],
  usos_vehiculo: [{ nombre: "usos_vehiculo_vehiculo_fecha_obra_key", cols: ["vehiculo_id", "fecha", "obra_id"] }],
  gastos: [{ nombre: "gastos_factura_origen_unica", cols: ["factura_origen_id"] }],
  notas_audio: [{ nombre: "notas_audio_obra_id_fecha_key", cols: ["obra_id", "fecha"] }],
  proveedores: [
    {
      nombre: "proveedores_owner_nombre_idx",
      cols: ["owner_id", "nombre"],
      etiqueta: "owner_id, lower(nombre)",
      clave: (f) => [f.owner_id, String(f.nombre ?? "").toLowerCase()],
    },
  ],
};

function unicasDe(tabla: Tabla): Unica[] {
  return [{ nombre: `${tabla}_pkey`, cols: ESQUEMA[tabla].pk }, ...(UNICAS[tabla] ?? [])];
}

const HORA_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const enLista = (v: unknown, l: string[]) => v == null || l.includes(String(v));

const CHECKS: Partial<Record<Tabla, { nombre: string; ok: (f: Fila) => boolean }[]>> = {
  miembros: [
    { nombre: "miembros_rol_check", ok: (f) => enLista(f.rol, ["dueno", "manager", "jefe_obra", "trabajador"]) },
  ],
  obras: [
    { nombre: "obras_hora_inicio_turno_check", ok: (f) => f.hora_inicio_turno == null || HORA_RE.test(String(f.hora_inicio_turno)) },
  ],
  fichajes: [{ nombre: "fichajes_transporte_check", ok: (f) => enLista(f.transporte, ["propio", "traido"]) }],
  gastos: [{ nombre: "gastos_pagado_por_check", ok: (f) => enLista(f.pagado_por, ["empresa", "personal"]) }],
  facturas: [{ nombre: "facturas_pagado_por_check", ok: (f) => enLista(f.pagado_por, ["empresa", "personal"]) }],
  cobros: [{ nombre: "cobros_importe_positivo", ok: (f) => Number(f.importe) > 0 }],
  entregas: [{ nombre: "entregas_importe_positivo", ok: (f) => Number(f.importe) > 0 }],
  tareas: [
    { nombre: "tareas_avance_check", ok: (f) => Number(f.avance) >= 0 && Number(f.avance) <= 100 },
    { nombre: "tareas_fechas_check", ok: (f) => String(f.fecha_fin) >= String(f.fecha_inicio) },
  ],
};

type Accion = "restrict" | "setnull" | "noaction";
type Fk = { tabla: Tabla; col: string; ref: Tabla | "users"; accion: Accion };

const FKS: Fk[] = [
  { tabla: "miembros", col: "user_id", ref: "users", accion: "restrict" },
  { tabla: "miembros", col: "obra_id", ref: "obras", accion: "setnull" },
  { tabla: "miembros", col: "trabajador_id", ref: "trabajadores", accion: "setnull" },
  { tabla: "miembros", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "ajustes", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "ajustes", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "soporte_accesos", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "soporte_accesos", col: "otorgado_a", ref: "users", accion: "noaction" },
  { tabla: "soporte_accesos", col: "otorgado_por", ref: "users", accion: "noaction" },
  { tabla: "soporte_accesos", col: "revocado_por", ref: "users", accion: "noaction" },
  { tabla: "admins_plataforma", col: "user_id", ref: "users", accion: "noaction" },
  { tabla: "codigos_alta", col: "creado_por", ref: "users", accion: "setnull" },
  { tabla: "codigos_alta", col: "usado_por", ref: "users", accion: "setnull" },
  { tabla: "codigos_alta", col: "empresa_id", ref: "empresas", accion: "setnull" },
  { tabla: "obras", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "obras", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "trabajadores", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "trabajadores", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "vehiculos", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "vehiculos", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "fichajes", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "fichajes", col: "trabajador_id", ref: "trabajadores", accion: "restrict" },
  { tabla: "fichajes_historial", col: "fichaje_id", ref: "fichajes", accion: "restrict" },
  { tabla: "fichajes_historial", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "fichajes_historial", col: "trabajador_id", ref: "trabajadores", accion: "restrict" },
  { tabla: "fichajes_historial", col: "cambiado_por", ref: "users", accion: "setnull" },
  { tabla: "fichajes_historial", col: "obra_id_antes", ref: "obras", accion: "noaction" },
  { tabla: "fichajes_historial", col: "obra_id_despues", ref: "obras", accion: "noaction" },
  { tabla: "usos_vehiculo", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "usos_vehiculo", col: "vehiculo_id", ref: "vehiculos", accion: "restrict" },
  { tabla: "usos_vehiculo", col: "conductor_id", ref: "trabajadores", accion: "setnull" },
  { tabla: "gastos", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "facturas", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "cobros", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "entregas", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "entregas", col: "empresa_id", ref: "empresas", accion: "noaction" },
  { tabla: "entregas", col: "obra_id", ref: "obras", accion: "setnull" },
  { tabla: "notas_audio", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "tareas", col: "obra_id", ref: "obras", accion: "restrict" },
  { tabla: "proveedores", col: "owner_id", ref: "users", accion: "restrict" },
  { tabla: "proveedores", col: "empresa_id", ref: "empresas", accion: "noaction" },
];

const nombreFk = (f: Fk) => `${f.tabla}_${f.col}_fkey`;

function existeRef(a: Almacen, ref: Tabla | "users", valor: unknown): boolean {
  if (ref === "users") return a.usuarios.some((u) => u.id === valor);
  return a.tablas[ref].some((f) => (ref === "miembros" ? f.user_id : f.id) === valor);
}

// ---------------------------------------------------------------------------
// Coerción de valores (lo que Postgres hace al recibir un valor JSON)
// ---------------------------------------------------------------------------

function fechaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function coaccionar(col: Col, valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  const sintaxis = (tipo: string) =>
    new ErrorBD(`invalid input syntax for type ${tipo}: "${String(valor)}"`, "22P02");
  switch (col.tipo) {
    case "uuid":
      if (typeof valor !== "string" || !RE_UUID.test(valor)) throw sintaxis("uuid");
      return valor;
    case "texto":
      return typeof valor === "string" ? valor : String(valor);
    case "bool":
      if (typeof valor === "boolean") return valor;
      if (valor === "true") return true;
      if (valor === "false") return false;
      throw sintaxis("boolean");
    case "num": {
      const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : NaN;
      if (!Number.isFinite(n)) throw sintaxis("numeric");
      if (col.escala === undefined) return n;
      const f = 10 ** col.escala;
      const r = Math.round((n + Math.sign(n) * Number.EPSILON) * f) / f;
      if (Math.abs(r) >= 1e10) throw new ErrorBD("numeric field overflow", "22003");
      return r;
    }
    case "entero": {
      const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor) : NaN;
      if (!Number.isInteger(n)) throw sintaxis("integer");
      return n;
    }
    case "fecha": {
      if (typeof valor !== "string") throw sintaxis("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw sintaxis("date");
      if (!fechaValida(valor)) throw new ErrorBD(`date/time field value out of range: "${valor}"`, "22008");
      return valor;
    }
    case "ts": {
      if (valor instanceof Date) return valor.toISOString();
      if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) throw sintaxis("timestamp with time zone");
      return valor;
    }
  }
}

function validarColumnas(tabla: Tabla, obj: Fila) {
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined && !(k in ESQUEMA[tabla].cols)) {
      throw new ErrorBD(`Could not find the '${k}' column of '${tabla}' in the schema cache`, "PGRST204");
    }
  }
}

function resolverEspecial(c: Ctx) {
  return (e: DefectoEspecial["esp"]): unknown => {
    switch (e) {
      case "uuid":
        return uuid();
      case "ahora":
        return c.ahora.toISOString();
      case "mi_empresa":
        return miEmpresaId(c);
      case "owner_empresa":
        return ownerEmpresa(c);
      case "empresa_defecto":
        return empresaPorDefecto(c.almacen);
      case "codigo_empresa": {
        for (;;) {
          const cod = uuid().replace(/-/g, "").slice(0, 8);
          if (!tab(c, "empresas").some((x) => x.codigo === cod)) return cod;
        }
      }
      case "serie":
        return c.almacen.sigErrorId++;
    }
  };
}

function construirFila(c: Ctx, tabla: Tabla, entrada: Fila): Fila {
  validarColumnas(tabla, entrada);
  const cols = ESQUEMA[tabla].cols;
  const coaccionada: Fila = {};
  for (const [k, v] of Object.entries(entrada)) {
    if (v !== undefined) coaccionada[k] = coaccionar(cols[k], v);
  }
  // Los defectos solo se calculan para las columnas ausentes.
  const fila = rellenarFila(tabla, coaccionada, resolverEspecial(c));
  return fila;
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

type OpTrigger = "insert" | "update" | "delete";

function protegerHorasFichaje(c: Ctx, op: OpTrigger, n: Fila, v: Fila | null) {
  if (!c.uid) return;
  if (miRol(c) === "dueno") return;
  const { fecha: hoy, hora: ahora } = madrid(c.ahora);

  if (op === "insert") {
    n.hora_corregida = false;
  } else if (v) {
    n.hora_corregida = v.hora_corregida;
    if (!igual(n.fecha, v.fecha) || !igual(n.obra_id, v.obra_id) || !igual(n.trabajador_id, v.trabajador_id)) {
      throw excepcion("Solo el dueño puede cambiar un fichaje ya hecho.");
    }
  }

  for (const campo of ["hora_entrada", "hora_salida"] as const) {
    const cambia = (op === "insert" && n[campo] != null) || (op === "update" && v !== null && !igual(n[campo], v[campo]));
    if (!cambia) continue;
    if (op === "update" && v !== null && v[campo] != null) {
      throw excepcion(
        campo === "hora_entrada"
          ? "La entrada ya está fichada. Solo el dueño puede cambiarla."
          : "La salida ya está fichada. Solo el dueño puede cambiarla.",
      );
    }
    if (n.fecha !== hoy) throw excepcion("Solo se puede fichar el día de hoy.");
    n[campo] = ahora;
  }
}

function registrarCorreccionFichaje(op: OpTrigger, n: Fila, v: Fila | null) {
  if (op === "insert") {
    if (n.hora_corregida) n.confirmado_trabajador = false;
  } else if (v) {
    if (!igual(n.hora_entrada, v.hora_entrada) || !igual(n.hora_salida, v.hora_salida) || !igual(n.obra_id, v.obra_id)) {
      n.confirmado_trabajador = false;
    }
  }
}

function validarHoraFichaje(c: Ctx, op: OpTrigger, n: Fila, v: Fila | null) {
  if (!c.uid || miRol(c) === "dueno") return;
  if (n.hora_entrada == null) return;
  if (!(op === "insert" || (v !== null && !igual(n.hora_entrada, v.hora_entrada)))) return;
  const obra = tab(c, "obras").find((o) => o.id === n.obra_id && politica(c, "obras", "select", o));
  if (!obra || obra.hora_inicio_turno == null) return;
  const inicio = String(obra.hora_inicio_turno);
  const [h, m] = inicio.split(":").map(Number);
  // (fecha + hora) - N minutos, y se queda con la hora: da la vuelta a medianoche como en SQL.
  const total = (((h * 60 + m - Number(obra.minutos_antes_permitidos ?? 30)) % 1440) + 1440) % 1440;
  const limite = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  if (String(n.hora_entrada) < limite) {
    throw excepcion(`Todavía no puedes fichar: el turno empieza a las ${inicio}. Puedes entrar desde las ${limite}.`);
  }
}

function protegerPagadoPorMi(c: Ctx, op: OpTrigger, n: Fila | null, v: Fila | null) {
  if (!c.uid || miRol(c) === "dueno") return;
  if (op === "insert") {
    if (n && n.pagado_por === "personal") throw excepcion("Solo el dueño puede apuntar gastos pagados por él.");
    return;
  }
  if (v && v.pagado_por === "personal") {
    throw excepcion("Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.");
  }
  if (op === "update" && n && n.pagado_por === "personal") {
    throw excepcion("Solo el dueño puede marcar un gasto como pagado por él.");
  }
}

/** BEFORE triggers, en el orden alfabético de Postgres. Mutan `n`. */
function antes(c: Ctx, tabla: Tabla, op: OpTrigger, n: Fila | null, v: Fila | null) {
  if (tabla === "fichajes" && n) {
    protegerHorasFichaje(c, op, n, v);
    registrarCorreccionFichaje(op, n, v);
    validarHoraFichaje(c, op, n, v);
  } else if (tabla === "gastos") {
    protegerPagadoPorMi(c, op, n, v);
  }
}

/** AFTER triggers (registrar_historial_fichaje es SECURITY DEFINER: salta el RLS). */
function despues(c: Ctx, tabla: Tabla, op: OpTrigger, n: Fila | null, v: Fila | null) {
  if (tabla !== "fichajes" || !n) return;
  const base = {
    fichaje_id: n.id,
    obra_id: n.obra_id,
    trabajador_id: n.trabajador_id,
    fecha: n.fecha,
    cambiado_por: c.uid,
    cambiado_en: c.ahora.toISOString(),
  };
  if (op === "insert") {
    if (!n.hora_corregida) return;
    insertarFila(c, "fichajes_historial", {
      ...base,
      hora_entrada_antes: null,
      hora_salida_antes: null,
      hora_entrada_despues: n.hora_entrada,
      hora_salida_despues: n.hora_salida,
    }, "sistema");
  } else if (op === "update" && v) {
    const cambioObra = !igual(n.obra_id, v.obra_id);
    if (igual(n.hora_entrada, v.hora_entrada) && igual(n.hora_salida, v.hora_salida) && !cambioObra) return;
    insertarFila(c, "fichajes_historial", {
      ...base,
      hora_entrada_antes: v.hora_entrada,
      hora_salida_antes: v.hora_salida,
      hora_entrada_despues: n.hora_entrada,
      hora_salida_despues: n.hora_salida,
      obra_id_antes: cambioObra ? v.obra_id : null,
      obra_id_despues: cambioObra ? n.obra_id : null,
    }, "sistema");
  }
}

// ---------------------------------------------------------------------------
// DML
// ---------------------------------------------------------------------------

type Modo = "usuario" | "sistema";

/** Ejecuta `f` de forma atómica: si algo falla, las tablas vuelven a como estaban. */
export function transaccion<T>(c: Ctx, f: () => T): T {
  const tablas = structuredClone(c.almacen.tablas);
  const usuarios = structuredClone(c.almacen.usuarios);
  try {
    return f();
  } catch (e) {
    c.almacen.tablas = tablas;
    c.almacen.usuarios = usuarios;
    throw e;
  }
}

function comprobarFila(c: Ctx, tabla: Tabla, f: Fila) {
  for (const [nombre, col] of Object.entries(ESQUEMA[tabla].cols)) {
    if (!col.nulo && f[nombre] == null) {
      throw new ErrorBD(`null value in column "${nombre}" of relation "${tabla}" violates not-null constraint`, "23502");
    }
  }
  for (const ch of CHECKS[tabla] ?? []) {
    if (!ch.ok(f)) {
      throw new ErrorBD(`new row for relation "${tabla}" violates check constraint "${ch.nombre}"`, "23514");
    }
  }
}

function comprobarUnicas(c: Ctx, tabla: Tabla, f: Fila, excepto: Fila | null) {
  for (const u of unicasDe(tabla)) {
    const clave = u.clave ? u.clave(f) : u.cols.map((k) => f[k]);
    if (u.clave ? clave.some((x) => x == null) : clave.some((x) => x == null)) continue;
    const choca = tab(c, tabla).some((o) => {
      if (o === excepto) return false;
      const ko = u.clave ? u.clave(o) : u.cols.map((k) => o[k]);
      return ko.every((x, i) => x === clave[i]);
    });
    if (choca) {
      throw new ErrorBD(
        `duplicate key value violates unique constraint "${u.nombre}"`,
        "23505",
        `Key (${u.etiqueta ?? u.cols.join(", ")})=(${clave.join(", ")}) already exists.`,
      );
    }
  }
}

function comprobarFks(c: Ctx, tabla: Tabla, f: Fila, antes: Fila | null) {
  for (const fk of FKS) {
    if (fk.tabla !== tabla) continue;
    const v = f[fk.col];
    if (v == null) continue;
    if (antes && igual(antes[fk.col], v)) continue;
    if (!existeRef(c.almacen, fk.ref, v)) {
      throw new ErrorBD(
        `insert or update on table "${tabla}" violates foreign key constraint "${nombreFk(fk)}"`,
        "23503",
        `Key (${fk.col})=(${String(v)}) is not present in table "${fk.ref}".`,
      );
    }
  }
}

/** INSERT de una fila con todas las reglas. */
export function insertarFila(c: Ctx, tabla: Tabla, entrada: Fila, modo: Modo): Fila {
  const n = construirFila(c, tabla, entrada);
  antes(c, tabla, "insert", n, null);
  if (modo === "usuario" && !politica(c, tabla, "insert", n)) throw errorRls(tabla);
  comprobarFila(c, tabla, n);
  comprobarUnicas(c, tabla, n, null);
  comprobarFks(c, tabla, n, null);
  tab(c, tabla).push(n);
  despues(c, tabla, "insert", n, null);
  return n;
}

/** UPDATE de una fila ya localizada. Devuelve la fila nueva. */
export function actualizarFila(c: Ctx, tabla: Tabla, vieja: Fila, parche: Fila, modo: Modo): Fila {
  const n: Fila = { ...vieja, ...parche };
  antes(c, tabla, "update", n, vieja);
  if (modo === "usuario" && !politica(c, tabla, "update", n)) throw errorRls(tabla);
  comprobarFila(c, tabla, n);
  comprobarUnicas(c, tabla, n, vieja);
  comprobarFks(c, tabla, n, vieja);
  const filas = tab(c, tabla);
  const idx = filas.indexOf(vieja);
  if (idx >= 0) filas[idx] = n;
  despues(c, tabla, "update", n, vieja);
  return n;
}

/** DELETE de una fila ya localizada (respeta RESTRICT y aplica SET NULL). */
export function borrarFila(c: Ctx, tabla: Tabla, fila: Fila, _modo: Modo): void {
  antes(c, tabla, "delete", null, fila);
  for (const fk of FKS) {
    if (fk.ref !== tabla) continue;
    const refCol = tabla === "miembros" ? "user_id" : "id";
    const hijos = tab(c, fk.tabla).filter((h) => h[fk.col] === fila[refCol]);
    if (hijos.length === 0) continue;
    if (fk.accion === "setnull") {
      for (const h of hijos) h[fk.col] = null;
    } else {
      throw new ErrorBD(
        `update or delete on table "${tabla}" violates foreign key constraint "${nombreFk(fk)}" on table "${fk.tabla}"`,
        "23503",
        `Key (${refCol})=(${String(fila[refCol])}) is still referenced from table "${fk.tabla}".`,
      );
    }
  }
  const filas = tab(c, tabla);
  const idx = filas.indexOf(fila);
  if (idx >= 0) filas.splice(idx, 1);
}

const copia = (f: Fila): Fila => ({ ...f });

/** Con RETURNING hace falta que la fila resultante sea visible (política SELECT). */
function devolverFilas(c: Ctx, tabla: Tabla, filas: Fila[], devolver: boolean): Fila[] {
  if (!devolver) return [];
  for (const f of filas) if (!politica(c, tabla, "select", f)) throw errorRls(tabla);
  return filas.map(copia);
}

export function dmlInsertar(c: Ctx, tabla: Tabla, entradas: Fila[], devolver: boolean): Fila[] {
  return transaccion(c, () => {
    const hechas = entradas.map((e) => insertarFila(c, tabla, e, "usuario"));
    return devolverFilas(c, tabla, hechas, devolver);
  });
}

export function dmlActualizar(
  c: Ctx,
  tabla: Tabla,
  filtro: (f: Fila) => boolean,
  parche: Fila,
  devolver: boolean,
): Fila[] {
  validarColumnas(tabla, parche);
  const cols = ESQUEMA[tabla].cols;
  const coaccionado: Fila = {};
  for (const [k, v] of Object.entries(parche)) if (v !== undefined) coaccionado[k] = coaccionar(cols[k], v);
  return transaccion(c, () => {
    const objetivo = tab(c, tabla).filter(
      (f) => politica(c, tabla, "select", f) && filtro(f) && politica(c, tabla, "update", f),
    );
    const nuevas = objetivo.map((f) => actualizarFila(c, tabla, f, coaccionado, "usuario"));
    return devolverFilas(c, tabla, nuevas, devolver);
  });
}

export function dmlBorrar(c: Ctx, tabla: Tabla, filtro: (f: Fila) => boolean, devolver: boolean): Fila[] {
  return transaccion(c, () => {
    const objetivo = tab(c, tabla).filter(
      (f) => politica(c, tabla, "select", f) && filtro(f) && politica(c, tabla, "delete", f),
    );
    const viejas = objetivo.map(copia);
    for (const f of objetivo) borrarFila(c, tabla, f, "usuario");
    return devolver ? viejas : [];
  });
}

export function dmlUpsert(
  c: Ctx,
  tabla: Tabla,
  entradas: Fila[],
  onConflict: string[] | null,
  ignorarDuplicados: boolean,
  devolver: boolean,
): Fila[] {
  const objetivo = onConflict && onConflict.length > 0 ? onConflict : ESQUEMA[tabla].pk;
  const valido = unicasDe(tabla).some(
    (u) => !u.clave && u.cols.length === objetivo.length && objetivo.every((k) => u.cols.includes(k)),
  );
  return transaccion(c, () => {
    if (!valido) {
      throw new ErrorBD("there is no unique or exclusion constraint matching the ON CONFLICT specification", "42P10");
    }
    const resultado: Fila[] = [];
    for (const entrada of entradas) {
      const n = construirFila(c, tabla, entrada);
      antes(c, tabla, "insert", n, null);
      if (!politica(c, tabla, "insert", n)) throw errorRls(tabla);
      const existente = tab(c, tabla).find((f) => objetivo.every((k) => n[k] != null && f[k] === n[k]));
      if (!existente) {
        comprobarFila(c, tabla, n);
        comprobarUnicas(c, tabla, n, null);
        comprobarFks(c, tabla, n, null);
        tab(c, tabla).push(n);
        despues(c, tabla, "insert", n, null);
        resultado.push(n);
      } else if (!ignorarDuplicados) {
        if (!politica(c, tabla, "select", existente) || !politica(c, tabla, "update", existente)) throw errorRls(tabla);
        // DO UPDATE SET col = EXCLUDED.col, solo para las columnas enviadas;
        // EXCLUDED ya lleva lo que cambiaron los triggers BEFORE INSERT.
        const parche: Fila = {};
        for (const k of Object.keys(entrada)) if (entrada[k] !== undefined) parche[k] = n[k];
        resultado.push(actualizarFila(c, tabla, existente, parche, "usuario"));
      }
    }
    return devolverFilas(c, tabla, resultado, devolver);
  });
}

