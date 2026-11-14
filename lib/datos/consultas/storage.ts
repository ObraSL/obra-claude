import { r, type Db, type Respuesta } from "@/lib/datos/db";

export const BUCKET_FACTURAS = "facturas";
export const BUCKET_NOTAS = "notas";

/** Ruta de un recibo de gasto; el primer segmento DEBE ser el id de obra. Usada en: Gastos. Spec: #91. */
export function rutaGasto(obraId: string, ext: string): string {
  return `${obraId}/gastos/${crypto.randomUUID()}.${ext}`;
}

/** Ruta del archivo de un cobro (mismo esquema que v1, carpeta cobros). Usada en: Dinero. Spec: #91. */
export function rutaCobro(obraId: string, ext: string): string {
  return `${obraId}/cobros/${crypto.randomUUID()}.${ext}`;
}

/** Ruta de una nota de voz. Usada en: Notas. Spec: #92. */
export function rutaNota(obraId: string, ext: string): string {
  return `${obraId}/${crypto.randomUUID()}.${ext}`;
}

/** Sube un archivo sin upsert. Usada en: Gastos, Dinero, Notas. Spec: #91, #92. */
export function subirArchivo(db: Db, bucket: string, path: string, blob: Blob, contentType: string | undefined): Promise<Respuesta<unknown>> {
  return r(db.storage.from(bucket).upload(path, blob, { contentType }));
}

/** Borra archivos del bucket. Usada en: Gastos, Dinero, Notas, EliminarObra. Spec: #94. */
export function borrarArchivos(db: Db, bucket: string, paths: string[]): Promise<Respuesta<unknown>> {
  return r(db.storage.from(bucket).remove(paths));
}

/** URL firmada temporal (facturas 600 s, notas 3600 s). Usada en: ArchivoViewer, Notas. Spec: #93. */
export async function urlFirmada(db: Db, bucket: string, path: string, segundos: number): Promise<Respuesta<string>> {
  const res = await r<{ signedUrl: string }>(db.storage.from(bucket).createSignedUrl(path, segundos));
  return { data: res.data?.signedUrl ?? null, error: res.error };
}
