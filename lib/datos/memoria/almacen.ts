/**
 * Almacén en memoria: las tablas de la base de datos de v1 como arrays de filas,
 * el esquema (columnas, tipos, valores por defecto) y la (de)serialización JSON
 * para guardar el estado en localStorage en el modo demo.
 *
 * Solo sintaxis de TypeScript borrable y sin imports de Node: corre igual en el
 * navegador y con el type-stripping nativo de Node 24.
 */
import { sembrar } from "./semilla";

export type Fila = Record<string, unknown>;

export const TABLAS = [
  "empresas",
  "miembros",
  "ajustes",
  "soporte_accesos",
  "admins_plataforma",
  "codigos_alta",
  "errores_app",
  "obras",
  "trabajadores",
  "vehiculos",
  "fichajes",
  "fichajes_historial",
  "usos_vehiculo",
  "gastos",
  "facturas",
  "cobros",
  "entregas",
  "notas_audio",
  "tareas",
  "proveedores",
] as const;

export type Tabla = (typeof TABLAS)[number];

export type UsuarioAuth = {
  id: string;
  email: string;
  password: string;
  confirmado: boolean;
  meta: Record<string, unknown>;
  created_at: string;
};

/** Un archivo de Storage: el contenido va como data URL para poder serializarlo. */
export type ArchivoAlmacen = { tipo: string; dataUrl: string };

export type Almacen = {
  tablas: Record<Tabla, Fila[]>;
  usuarios: UsuarioAuth[];
  /** Clave "bucket/ruta". */
  archivos: Record<string, ArchivoAlmacen>;
  sesion: { user_id: string } | null;
  /** Secuencia de errores_app.id. */
  sigErrorId: number;
};

export type Escenario = "poblado" | "vacio" | "textos-largos";

// ---------------------------------------------------------------------------
// Esquema
// ---------------------------------------------------------------------------

export type TipoCol = "uuid" | "texto" | "bool" | "num" | "entero" | "fecha" | "ts";

/** Valor por defecto calculado (necesita saber quién llama o qué hora es). */
export type DefectoEspecial = {
  esp: "uuid" | "ahora" | "mi_empresa" | "owner_empresa" | "empresa_defecto" | "codigo_empresa" | "serie";
};

export type Col = {
  tipo: TipoCol;
  nulo?: boolean;
  /** Literal, o un DefectoEspecial. undefined = sin valor por defecto. */
  def?: unknown;
  /** Decimales de un numeric(p, escala). */
  escala?: number;
};

export type EsquemaTabla = { cols: Record<string, Col>; pk: string[] };

const esp = (e: DefectoEspecial["esp"]): DefectoEspecial => ({ esp: e });
const idCol = (): Col => ({ tipo: "uuid", def: esp("uuid") });
const creadoCol = (): Col => ({ tipo: "ts", def: esp("ahora") });
const uuidCol = (nulo = false): Col => ({ tipo: "uuid", nulo });
const txt = (nulo = false): Col => ({ tipo: "texto", nulo });
const fec = (): Col => ({ tipo: "fecha" });
const empresaCol = (): Col => ({ tipo: "uuid", def: esp("mi_empresa") });

export const ESQUEMA: Record<Tabla, EsquemaTabla> = {
  empresas: {
    pk: ["id"],
    cols: {
      id: idCol(),
      nombre: txt(),
      created_at: creadoCol(),
      codigo: { tipo: "texto", def: esp("codigo_empresa") },
      activa_hasta: { tipo: "ts", nulo: true },
      bloqueada: { tipo: "bool", def: false },
    },
  },
  miembros: {
    pk: ["user_id"],
    cols: {
      user_id: uuidCol(),
      email: txt(),
      nombre: txt(true),
      rol: { tipo: "texto", def: "trabajador" },
      obra_id: uuidCol(true),
      trabajador_id: uuidCol(true),
      aprobado: { tipo: "bool", def: false },
      created_at: creadoCol(),
      empresa_id: { tipo: "uuid", def: esp("empresa_defecto") },
      aviso_control_leido_en: { tipo: "ts", nulo: true },
      aviso_control_version: txt(true),
      es_soporte: { tipo: "bool", def: false },
    },
  },
  ajustes: {
    pk: ["owner_id"],
    cols: {
      owner_id: uuidCol(),
      jornada_horas: { tipo: "num", def: 8, escala: 2 },
      updated_at: creadoCol(),
      empresa_id: empresaCol(),
      jefe_ve_todas: { tipo: "bool", def: false },
      mod_vehiculos: { tipo: "bool", def: true },
      mod_notas_voz: { tipo: "bool", def: true },
      mod_caja_jefe: { tipo: "bool", def: true },
      mod_transporte: { tipo: "bool", def: true },
      mod_geolocalizacion: { tipo: "bool", def: true },
    },
  },
  soporte_accesos: {
    pk: ["id"],
    cols: {
      id: idCol(),
      empresa_id: uuidCol(),
      otorgado_a: uuidCol(),
      email: txt(),
      otorgado_por: uuidCol(),
      otorgado_en: creadoCol(),
      expira_en: { tipo: "ts" },
      revocado_en: { tipo: "ts", nulo: true },
      revocado_por: uuidCol(true),
    },
  },
  admins_plataforma: {
    pk: ["user_id"],
    cols: { user_id: uuidCol() },
  },
  codigos_alta: {
    pk: ["id"],
    cols: {
      id: idCol(),
      codigo: txt(),
      nota: txt(true),
      creado_por: uuidCol(true),
      creado_en: creadoCol(),
      cancelado_en: { tipo: "ts", nulo: true },
      usado_en: { tipo: "ts", nulo: true },
      usado_por: uuidCol(true),
      empresa_id: uuidCol(true),
      email: txt(true),
      stripe_session_id: txt(true),
      stripe_customer_id: txt(true),
      stripe_subscription_id: txt(true),
      pagado_hasta: { tipo: "ts", nulo: true },
    },
  },
  errores_app: {
    pk: ["id"],
    cols: {
      id: { tipo: "entero", def: esp("serie") },
      creado_en: creadoCol(),
      origen: txt(),
      mensaje: txt(),
      detalle: txt(true),
      ruta: txt(true),
      navegador: txt(true),
      user_id: uuidCol(true),
      empresa_id: uuidCol(true),
    },
  },
  obras: {
    pk: ["id"],
    cols: {
      id: idCol(),
      owner_id: uuidCol(),
      nombre: txt(),
      direccion: txt(true),
      activa: { tipo: "bool", def: true },
      created_at: creadoCol(),
      empresa_id: empresaCol(),
      lat: { tipo: "num", nulo: true },
      lng: { tipo: "num", nulo: true },
      radio_metros: { tipo: "entero", def: 150 },
      hora_inicio_turno: txt(true),
      minutos_antes_permitidos: { tipo: "entero", def: 30 },
    },
  },
  trabajadores: {
    pk: ["id"],
    cols: {
      id: idCol(),
      owner_id: uuidCol(),
      nombre: txt(),
      activo: { tipo: "bool", def: true },
      created_at: creadoCol(),
      empresa_id: empresaCol(),
    },
  },
  vehiculos: {
    pk: ["id"],
    cols: {
      id: idCol(),
      owner_id: uuidCol(),
      nombre: txt(),
      activo: { tipo: "bool", def: true },
      created_at: creadoCol(),
      empresa_id: empresaCol(),
    },
  },
  fichajes: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      trabajador_id: uuidCol(),
      fecha: fec(),
      hora_entrada: txt(true),
      hora_salida: txt(true),
      ubicacion: txt(true),
      created_at: creadoCol(),
      transporte: txt(true),
      traido_por: txt(true),
      hora_corregida: { tipo: "bool", def: false },
      confirmado_trabajador: { tipo: "bool", def: true },
      ubicacion_ok: { tipo: "bool", nulo: true },
      distancia_metros: { tipo: "entero", nulo: true },
    },
  },
  fichajes_historial: {
    pk: ["id"],
    cols: {
      id: idCol(),
      fichaje_id: uuidCol(),
      obra_id: uuidCol(),
      trabajador_id: uuidCol(),
      fecha: fec(),
      hora_entrada_antes: txt(true),
      hora_salida_antes: txt(true),
      hora_entrada_despues: txt(true),
      hora_salida_despues: txt(true),
      cambiado_por: uuidCol(true),
      cambiado_en: creadoCol(),
      obra_id_antes: uuidCol(true),
      obra_id_despues: uuidCol(true),
    },
  },
  usos_vehiculo: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      vehiculo_id: uuidCol(),
      fecha: fec(),
      km_inicio: { tipo: "entero", nulo: true },
      km_fin: { tipo: "entero", nulo: true },
      destino: txt(true),
      conductor_id: uuidCol(true),
      created_at: creadoCol(),
    },
  },
  gastos: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      importe: { tipo: "num", escala: 2 },
      concepto: txt(true),
      categoria: txt(),
      fecha: fec(),
      recibo_path: txt(true),
      recibo_tipo: txt(true),
      created_at: creadoCol(),
      pagado_por: { tipo: "texto", def: "empresa" },
      proveedor: txt(true),
      factura_origen_id: uuidCol(true),
    },
  },
  facturas: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      proveedor: txt(true),
      importe: { tipo: "num", escala: 2 },
      fecha: fec(),
      tipo_archivo: txt(true),
      nombre_archivo: txt(true),
      storage_path: txt(),
      created_at: creadoCol(),
      pagado_por: { tipo: "texto", def: "empresa" },
    },
  },
  cobros: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      importe: { tipo: "num", escala: 2 },
      fecha: fec(),
      concepto: txt(true),
      archivo_path: txt(true),
      archivo_tipo: txt(true),
      created_at: creadoCol(),
    },
  },
  entregas: {
    pk: ["id"],
    cols: {
      id: idCol(),
      owner_id: uuidCol(),
      importe: { tipo: "num", escala: 2 },
      fecha: fec(),
      concepto: txt(true),
      obra_id: uuidCol(true),
      created_at: creadoCol(),
      empresa_id: empresaCol(),
    },
  },
  notas_audio: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      fecha: fec(),
      audio_path: txt(),
      duracion_seg: { tipo: "entero", nulo: true },
      created_at: creadoCol(),
    },
  },
  tareas: {
    pk: ["id"],
    cols: {
      id: idCol(),
      obra_id: uuidCol(),
      nombre: txt(),
      fecha_inicio: fec(),
      fecha_fin: fec(),
      avance: { tipo: "entero", def: 0 },
      orden: { tipo: "entero", def: 0 },
      created_at: creadoCol(),
      presupuesto: { tipo: "num", nulo: true, escala: 2 },
    },
  },
  proveedores: {
    pk: ["id"],
    cols: {
      id: idCol(),
      owner_id: { tipo: "uuid", def: esp("owner_empresa") },
      nombre: txt(),
      favorito: { tipo: "bool", def: false },
      created_at: creadoCol(),
      empresa_id: empresaCol(),
    },
  },
};

// ---------------------------------------------------------------------------
// Utilidades básicas (ids y fechas), compartidas por todos los módulos
// ---------------------------------------------------------------------------

export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const formatoMadrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha "YYYY-MM-DD" y hora "HH:MM" en Europe/Madrid para un instante. */
export function madrid(d: Date): { fecha: string; hora: string } {
  const p: Record<string, string> = {};
  for (const parte of formatoMadrid.formatToParts(d)) p[parte.type] = parte.value;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

const msDia = 86400000;
const utcDeIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const isoDeUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Suma días a una fecha "YYYY-MM-DD" (aritmética pura en UTC, sin husos). */
export const sumarDias = (iso: string, n: number) => isoDeUtc(utcDeIso(iso) + n * msDia);

/** Días de `a` a `b` (b - a). */
export const diasEntre = (a: string, b: string) => Math.round((utcDeIso(b) - utcDeIso(a)) / msDia);

/** 0 = domingo … 6 = sábado. */
export const diaSemana = (iso: string) => new Date(utcDeIso(iso)).getUTCDay();

/** Instante (ISO) de una fecha y una hora "HH:MM" en la zona horaria local. */
export function instante(fecha: string, hhmm: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0).toISOString();
}

// ---------------------------------------------------------------------------
// Creación y serialización
// ---------------------------------------------------------------------------

export function almacenVacio(): Almacen {
  const tablas = {} as Record<Tabla, Fila[]>;
  for (const t of TABLAS) tablas[t] = [];
  return { tablas, usuarios: [], archivos: {}, sesion: null, sigErrorId: 1 };
}

/** Un almacén nuevo con los datos sintéticos del escenario. */
export function crearAlmacen(escenario: Escenario = "poblado", hoy: Date = new Date()): Almacen {
  return sembrar(escenario, hoy);
}

export function serializar(a: Almacen): string {
  return JSON.stringify(a);
}

export function deserializar(texto: string): Almacen {
  const bruto = JSON.parse(texto) as Partial<Almacen> | null;
  if (!bruto || typeof bruto !== "object" || !bruto.tablas) {
    throw new Error("Estado del almacén en memoria no válido.");
  }
  const a = almacenVacio();
  for (const t of TABLAS) a.tablas[t] = Array.isArray(bruto.tablas[t]) ? bruto.tablas[t] : [];
  a.usuarios = Array.isArray(bruto.usuarios) ? bruto.usuarios : [];
  a.archivos = bruto.archivos && typeof bruto.archivos === "object" ? bruto.archivos : {};
  a.sesion = bruto.sesion ?? null;
  a.sigErrorId = typeof bruto.sigErrorId === "number" ? bruto.sigErrorId : a.tablas.errores_app.length + 1;
  return a;
}

/** Copia independiente del almacén (útil en tests y en la galería). */
export function clonarAlmacen(a: Almacen): Almacen {
  return deserializar(serializar(a));
}

/**
 * Rellena una fila con los valores por defecto del esquema SIN validar nada
 * (la usa la semilla). `especial` resuelve los defectos que dependen del contexto.
 */
export function rellenarFila(
  tabla: Tabla,
  entrada: Fila,
  especial: (e: DefectoEspecial["esp"]) => unknown,
): Fila {
  const fila: Fila = {};
  for (const [nombre, col] of Object.entries(ESQUEMA[tabla].cols)) {
    const v = entrada[nombre];
    if (v !== undefined) fila[nombre] = v;
    else if (col.def !== undefined) {
      fila[nombre] =
        typeof col.def === "object" && col.def !== null && "esp" in col.def
          ? especial((col.def as DefectoEspecial).esp)
          : col.def;
    } else fila[nombre] = null;
  }
  return fila;
}
