/**
 * Storage en memoria: buckets "facturas" y "notas" (privados). La política de
 * D §3.1: solo dueño/manager/jefe de obra (según su alcance) de la obra cuyo id
 * es el PRIMER segmento de la ruta; los trabajadores no tienen acceso.
 * Los archivos se guardan como data URL (serializable) y la "URL firmada" es
 * esa misma data URL: la puede cargar un <img>, un <iframe> o un <audio>.
 */
import { RE_UUID } from "./almacen";
import { puedeGestionarObra, type Ctx } from "./reglas";

export type ErrorStorage = { name: string; message: string; statusCode: string; error: string };
export type ResultadoStorage = { data: unknown; error: ErrorStorage | null };

const BUCKETS = ["facturas", "notas"];

const err = (statusCode: string, error: string, message: string): ErrorStorage => ({
  name: "StorageApiError",
  message,
  statusCode,
  error,
});

export const storageFallo = (mensaje: string): ResultadoStorage => ({
  data: null,
  error: { name: "StorageUnknownError", message: mensaje, statusCode: "", error: "" },
});

/** null = permitido; si no, el error que daría Storage. */
function comprobarAcceso(c: Ctx, bucket: string, ruta: string): ErrorStorage | null {
  if (!BUCKETS.includes(bucket)) return err("404", "Bucket not found", "Bucket not found");
  const primero = ruta.replace(/^\/+/, "").split("/")[0];
  if (!RE_UUID.test(primero)) {
    return err("500", "Internal Server Error", `invalid input syntax for type uuid: "${primero}"`);
  }
  if (!puedeGestionarObra(c, primero)) {
    return err("403", "Unauthorized", "new row violates row-level security policy");
  }
  return null;
}

const limpia = (ruta: string) => ruta.replace(/^\/+/, "");
const clave = (bucket: string, ruta: string) => `${bucket}/${limpia(ruta)}`;

function aBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export type CuerpoArchivo = Blob | ArrayBuffer | ArrayBufferView | string;

async function aBytes(cuerpo: CuerpoArchivo): Promise<{ bytes: Uint8Array; tipo: string }> {
  if (typeof cuerpo === "string") return { bytes: new TextEncoder().encode(cuerpo), tipo: "text/plain" };
  if (cuerpo instanceof ArrayBuffer) return { bytes: new Uint8Array(cuerpo), tipo: "" };
  if (ArrayBuffer.isView(cuerpo)) {
    return { bytes: new Uint8Array(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength), tipo: "" };
  }
  return { bytes: new Uint8Array(await cuerpo.arrayBuffer()), tipo: cuerpo.type };
}

export async function subir(
  c: Ctx,
  bucket: string,
  ruta: string,
  cuerpo: CuerpoArchivo,
  opciones?: { contentType?: string; upsert?: boolean },
): Promise<ResultadoStorage> {
  const e = comprobarAcceso(c, bucket, ruta);
  if (e) return { data: null, error: e };
  const k = clave(bucket, ruta);
  if (c.almacen.archivos[k] && !opciones?.upsert) {
    return { data: null, error: err("409", "Duplicate", "The resource already exists") };
  }
  const { bytes, tipo } = await aBytes(cuerpo);
  const contentType = opciones?.contentType || tipo || "application/octet-stream";
  c.almacen.archivos[k] = { tipo: contentType, dataUrl: `data:${contentType};base64,${aBase64(bytes)}` };
  return { data: { path: limpia(ruta), id: k, fullPath: k }, error: null };
}

export function quitar(c: Ctx, bucket: string, rutas: string[]): ResultadoStorage {
  const quitados: { name: string; bucket_id: string }[] = [];
  for (const ruta of rutas) {
    const e = comprobarAcceso(c, bucket, ruta);
    if (e) {
      // Un bucket inexistente o una ruta que no es uuid dan error; sin permiso, el RLS simplemente oculta el objeto.
      if (e.statusCode !== "403") return { data: null, error: e };
      continue;
    }
    const k = clave(bucket, ruta);
    if (c.almacen.archivos[k]) {
      delete c.almacen.archivos[k];
      quitados.push({ name: limpia(ruta), bucket_id: bucket });
    }
  }
  return { data: quitados, error: null };
}

export function urlFirmada(c: Ctx, bucket: string, ruta: string, _segundos?: number): ResultadoStorage {
  const e = comprobarAcceso(c, bucket, ruta);
  const a = e ? undefined : c.almacen.archivos[clave(bucket, ruta)];
  if (e && e.statusCode !== "403") return { data: null, error: e };
  if (!a) return { data: null, error: err("404", "not_found", "Object not found") };
  return { data: { signedUrl: a.dataUrl }, error: null };
}

export async function descargar(c: Ctx, bucket: string, ruta: string): Promise<ResultadoStorage> {
  const r = urlFirmada(c, bucket, ruta);
  if (r.error) return r;
  const url = (r.data as { signedUrl: string }).signedUrl;
  const blob = await (await fetch(url)).blob();
  return { data: blob, error: null };
}
