/**
 * Base de datos en memoria: un cliente que imita a `SupabaseClient` y corre las
 * MISMAS consultas que la app sobre tablas en memoria, con las reglas de la base
 * real (RLS, triggers, restricciones, RPC). Sirve para el modo demo, la galería
 * de diseño y los tests de punta a punta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clonarAlmacen,
  crearAlmacen,
  deserializar,
  serializar,
  type Almacen,
  type Escenario,
} from "./almacen";
import { crearAuth, confirmarEmail, type EstadoSesion } from "./auth";
import { ConstructorConsulta, type Entorno } from "./consulta";
import { crearCtx, type Ctx } from "./reglas";
import { ConstructorRpc, llamarRpcComoServicio } from "./rpc";
import { descargar, quitar, storageFallo, subir, urlFirmada, type CuerpoArchivo } from "./storage";
import { CODIGOS_DEMO, CONTRASENA_DEMO, CUENTAS_DEMO } from "./semilla";

export type ModoRed = "normal" | "cargando" | "error" | "sin-conexion";
export type EscenarioMemoria = Escenario;

export type OpcionesClienteMemoria = {
  almacen: Almacen;
  /** Se lee en cada llamada, así se puede cambiar el modo en caliente. */
  red?: () => ModoRed;
  /** Latencia artificial en ms (0 por defecto; la demo usa ~150). */
  latenciaMs?: number;
  /** Reloj inyectable (tests). Por defecto, la hora real. */
  reloj?: () => Date;
  /** Se llama tras cada escritura correcta (el modo demo lo usa para guardar). */
  alCambiar?: () => void;
};

export const MENSAJE_ERROR_PRUEBA = "Error de prueba: el servidor no responde.";
export const MENSAJE_SIN_CONEXION = "TypeError: Failed to fetch";

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const hayError = (r: unknown): boolean =>
  typeof r === "object" && r !== null && "error" in r && (r as { error: unknown }).error != null;

export function crearClienteMemoria(op: OpcionesClienteMemoria): SupabaseClient {
  const almacen = op.almacen;
  const reloj = op.reloj ?? (() => new Date());
  const red = op.red ?? (() => "normal" as ModoRed);
  const latencia = op.latenciaMs ?? 0;
  // Cada cliente tiene su propia sesión; arranca con la que haya guardada en el almacén.
  const estado: EstadoSesion = { sesion: almacen.sesion };

  const entorno: Entorno = {
    correr: async <R>(
      trabajo: (c: Ctx) => R | Promise<R>,
      fallo: (mensaje: string) => R,
      escritura: boolean,
    ): Promise<R> => {
      const modo = red();
      if (modo === "cargando") return new Promise<R>(() => {});
      if (latencia > 0) await esperar(latencia);
      if (modo === "error") return fallo(MENSAJE_ERROR_PRUEBA);
      if (modo === "sin-conexion") return fallo(MENSAJE_SIN_CONEXION);
      const resultado = await trabajo(crearCtx(almacen, reloj(), estado.sesion?.user_id ?? null));
      if (escritura && !hayError(resultado) && op.alCambiar) {
        try {
          op.alCambiar();
        } catch {
          /* guardar el estado no debe romper la operación */
        }
      }
      return resultado;
    },
  };

  const cliente = {
    from: (tabla: string) => new ConstructorConsulta(entorno, tabla),
    rpc: (nombre: string, args?: Record<string, unknown>) => new ConstructorRpc(entorno, nombre, args),
    storage: {
      from: (bucket: string) => ({
        upload: (ruta: string, cuerpo: CuerpoArchivo, opciones?: { contentType?: string; upsert?: boolean }) =>
          entorno.correr((c) => subir(c, bucket, ruta, cuerpo, opciones), storageFallo, true),
        remove: (rutas: string[]) => entorno.correr((c) => quitar(c, bucket, rutas), storageFallo, true),
        createSignedUrl: (ruta: string, segundos?: number) =>
          entorno.correr((c) => urlFirmada(c, bucket, ruta, segundos), storageFallo, false),
        download: (ruta: string) => entorno.correr((c) => descargar(c, bucket, ruta), storageFallo, false),
      }),
    },
    auth: crearAuth(entorno, almacen, reloj, estado),
  };
  return cliente as unknown as SupabaseClient;
}

/** Ejecuta una RPC reservada a service_role (webhook de pagos) sobre el almacén. Para tests. */
export function llamarRpcServicio(almacen: Almacen, nombre: string, args: Record<string, unknown>, ahora: Date = new Date()): unknown {
  return llamarRpcComoServicio(crearCtx(almacen, ahora), nombre, args);
}

export const serializarAlmacen = (almacen: Almacen): string => serializar(almacen);
export const deserializarAlmacen = (json: string): Almacen => deserializar(json);

export { CODIGOS_DEMO, CUENTAS_DEMO, clonarAlmacen, confirmarEmail, crearAlmacen };
export const CLAVE_DEMO = CONTRASENA_DEMO;
export { CONTRASENA_DEMO };
export type { Almacen, Escenario, Fila, Tabla } from "./almacen";
export type { CuentaDemo } from "./semilla";
export { ErrorBD } from "./reglas";
