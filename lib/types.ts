/** Niveles de acceso. Todo el que se registra empieza como "trabajador". */
export type Rol = "dueno" | "manager" | "jefe_obra" | "trabajador";

export const ROLES: { id: Rol; label: string; descripcion: string }[] = [
  { id: "dueno", label: "Dueño", descripcion: "Acceso total y reparte permisos" },
  { id: "manager", label: "Manager", descripcion: "Ve y gestiona todas las obras" },
  { id: "jefe_obra", label: "Jefe de obra", descripcion: "Gestiona solo la obra que le asignes" },
  { id: "trabajador", label: "Trabajador", descripcion: "Solo ficha sus horas; no ve gastos ni a otros" },
];

/** Cuenta registrada en la app, con su nivel de acceso. */
export type Miembro = {
  user_id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  obra_id: string | null;
  trabajador_id: string | null;
  aprobado: boolean;
  aviso_control_leido_en: string | null;
  aviso_control_version: string | null;
  es_soporte: boolean;
  created_at: string;
};

/** Una fila de la lista de todas las empresas (solo para el admin de la plataforma). */
export type EmpresaAdmin = {
  id: string;
  nombre: string;
  codigo: string;
  created_at: string;
  miembros_count: number;
  obras_count: number;
  /** null = sin caducidad. */
  activa_hasta: string | null;
  bloqueada: boolean;
  /** Código de alta con el que se creó (null si es anterior a los códigos). */
  codigo_alta: string | null;
};

/** Un fallo guardado en errores_app (solo lo ve el admin de la plataforma). */
export type ErrorApp = {
  id: number;
  creado_en: string;
  origen: "navegador" | "servidor";
  mensaje: string;
  detalle: string | null;
  ruta: string | null;
  navegador: string | null;
  email: string | null;
  empresa: string | null;
};

/** Un código de alta que el admin de la plataforma da a un cliente nuevo. */
export type CodigoAlta = {
  id: string;
  codigo: string;
  nota: string | null;
  creado_en: string;
  estado: "libre" | "usado" | "cancelado";
  empresa_nombre: string | null;
  usado_en: string | null;
  /** Email de quien lo compró (solo en los pagados con tarjeta). */
  email: string | null;
  pagado: boolean;
};

/** Un acceso de soporte dado a una cuenta del desarrollador (punto 17). */
export type SoporteAcceso = {
  id: string;
  empresa_id: string;
  otorgado_a: string;
  email: string;
  otorgado_por: string;
  otorgado_en: string;
  expira_en: string;
  revocado_en: string | null;
  revocado_por: string | null;
};

/** Versión del texto del aviso de control de horario y geolocalización.
 *  Si cambia el contenido de verdad, subir esta versión para que se vuelva
 *  a pedir la lectura a todo el mundo. */
export const AVISO_CONTROL_VERSION = "2026-09-28";

export type Obra = {
  id: string;
  owner_id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  lat: number | null;
  lng: number | null;
  radio_metros: number;
  hora_inicio_turno: string | null; // 'HH:MM', null = sin regla de horario
  minutos_antes_permitidos: number;
  created_at: string;
};

export type Trabajador = {
  id: string;
  owner_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
};

export type Vehiculo = {
  id: string;
  owner_id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
};

/** Cómo llegó a la obra: en su coche, o le trajo otro (y quién). */
export type Transporte = "propio" | "traido";

export type Fichaje = {
  id: string;
  obra_id: string;
  trabajador_id: string;
  fecha: string; // YYYY-MM-DD
  hora_entrada: string | null; // HH:MM
  hora_salida: string | null; // HH:MM
  ubicacion: string | null;
  transporte: Transporte | null;
  traido_por: string | null; // nombre de quien le trajo, escrito a mano
  hora_corregida: boolean; // la puso el dueño a mano, no se fichó en el momento
  confirmado_trabajador: boolean; // el trabajador vio la corrección y dijo que está bien
  // "dentro/fuera del radio de la obra" al fichar — no se guardan las
  // coordenadas exactas, solo esto y la distancia. null = no se pudo saber
  // (permiso denegado, obra sin ubicación puesta, o no aplica).
  ubicacion_ok: boolean | null;
  distancia_metros: number | null;
  created_at: string;
};

export type FichajeHistorial = {
  id: string;
  fichaje_id: string;
  obra_id: string;
  trabajador_id: string;
  fecha: string;
  hora_entrada_antes: string | null;
  hora_salida_antes: string | null;
  hora_entrada_despues: string | null;
  hora_salida_despues: string | null;
  obra_id_antes: string | null;
  obra_id_despues: string | null;
  cambiado_por: string | null;
  cambiado_en: string;
};

export type UsoVehiculo = {
  id: string;
  obra_id: string;
  vehiculo_id: string;
  fecha: string;
  km_inicio: number | null;
  km_fin: number | null;
  destino: string | null;
  conductor_id: string | null;
  created_at: string;
};

export const CATEGORIAS_GASTO = [
  "Material",
  "Maquinaria / alquiler",
  "Combustible",
  "Mano de obra externa",
  // Lo que se paga a la cuadrilla en mano: hace falta apuntarlo para que
  // cuadre la caja con el dinero que da el jefe.
  "Sueldos",
  "Gestión de residuos",
  "Otros",
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

/**
 * Quién puso el dinero. "personal" = lo pagó el dueño de su mano (de su
 * bolsillo o del dinero que le dio el jefe), no la empresa directamente.
 */
export type PagadoPor = "empresa" | "personal";

/** Un gasto de la obra: ticket o factura, todo en el mismo sitio. */
export type Gasto = {
  id: string;
  obra_id: string;
  importe: number;
  concepto: string | null; // ahora es una nota opcional, no el nombre del gasto
  categoria: string;
  fecha: string;
  recibo_path: string | null;
  recibo_tipo: string | null;
  pagado_por: PagadoPor;
  proveedor: string | null;
  factura_origen_id: string | null; // venía de la lista vieja de facturas
  created_at: string;
};

/** Proveedor de la lista de la empresa. Los favoritos salen arriba. */
export type Proveedor = {
  id: string;
  owner_id: string;
  nombre: string;
  favorito: boolean;
  created_at: string;
};

/** Lo que paga el cliente por una obra. */
export type Cobro = {
  id: string;
  obra_id: string;
  importe: number;
  fecha: string;
  concepto: string | null;
  archivo_path: string | null;
  archivo_tipo: string | null;
  created_at: string;
};

/** Lo que el jefe le da al dueño. Dinero en general; la obra es opcional. */
export type Entrega = {
  id: string;
  owner_id: string;
  importe: number;
  fecha: string;
  concepto: string | null;
  obra_id: string | null;
  created_at: string;
};

/** Nota de voz del día: una por obra y día. */
export type NotaAudio = {
  id: string;
  obra_id: string;
  fecha: string;
  audio_path: string;
  duracion_seg: number | null;
  created_at: string;
};

/** Tarea de la planificación de la obra (una barra del diagrama de Gantt). */
export type Tarea = {
  id: string;
  obra_id: string;
  nombre: string;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  avance: number; // 0..100
  orden: number;
  presupuesto: number | null; // lo que hay presupuestado para esta parte
  created_at: string;
};

export type Factura = {
  id: string;
  obra_id: string;
  proveedor: string | null;
  importe: number;
  fecha: string;
  tipo_archivo: string | null;
  nombre_archivo: string | null;
  storage_path: string;
  pagado_por: PagadoPor;
  created_at: string;
};
