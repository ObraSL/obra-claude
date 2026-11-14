import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Obra } from "@/lib/types";

/** Todas las obras, incluidas las cerradas. Usada en: ObraProvider. Spec: #21. */
export function listarObras(db: Db): Promise<Respuesta<Obra[]>> {
  return r<Obra[]>(db.from("obras").select("*").order("created_at", { ascending: false }));
}

/** Crea una obra activa. Usada en: ObraPicker, SinObras, Ajustes. Spec: #22. */
export function crearObra(db: Db, userId: string, nombre: string, direccion: string): Promise<Respuesta<Obra>> {
  return r<Obra>(db.from("obras").insert({ owner_id: userId, nombre, direccion: direccion || null, activa: true }).select().single());
}

/** Abre o cierra una obra. Usada en: Ajustes. Spec: #23. */
export function cambiarActivaObra(db: Db, id: string, activa: boolean): Promise<Respuesta<Obra>> {
  return r<Obra>(db.from("obras").update({ activa }).eq("id", id).select().single());
}

/** Ubicación, radio y horario de la obra. Usada en: ConfigurarObra. Spec: #24. */
export function guardarUbicacionHorarioObra(
  db: Db,
  id: string,
  d: { lat: number | null; lng: number | null; radio: string | number; hora: string; min: string | number }
): Promise<Respuesta<Obra>> {
  return r<Obra>(
    db
      .from("obras")
      .update({
        lat: d.lat,
        lng: d.lng,
        radio_metros: Number(d.radio) || 150,
        hora_inicio_turno: d.hora || null,
        minutos_antes_permitidos: Number(d.min) || 0,
      })
      .eq("id", id)
      .select()
      .single()
  );
}

/** Avance de la obra (numeric). Usada en: InicioTrabajador. Spec: #25. */
export function avanceObra(db: Db, obraId: string): Promise<Respuesta<number>> {
  return r<number>(db.rpc("avance_obra", { o_id: obraId }));
}

/** Rutas de archivos de gastos, cobros y notas de una obra. Usada en: EliminarObra. Spec: #26. */
export async function archivosDeObra(
  db: Db,
  obraId: string
): Promise<{
  gastos: Respuesta<{ recibo_path: string | null }[]>;
  cobros: Respuesta<{ archivo_path: string | null }[]>;
  notas: Respuesta<{ audio_path: string }[]>;
}> {
  const [gastos, cobros, notas] = await Promise.all([
    r<{ recibo_path: string | null }[]>(db.from("gastos").select("recibo_path").eq("obra_id", obraId).not("recibo_path", "is", null)),
    r<{ archivo_path: string | null }[]>(db.from("cobros").select("archivo_path").eq("obra_id", obraId).not("archivo_path", "is", null)),
    r<{ audio_path: string }[]>(db.from("notas_audio").select("audio_path").eq("obra_id", obraId)),
  ]);
  return { gastos, cobros, notas };
}

/** Borra la obra y todo lo suyo en la base. Usada en: EliminarObra. Spec: #27. */
export function eliminarObraRpc(db: Db, obraId: string): Promise<Respuesta<unknown>> {
  return r(db.rpc("eliminar_obra", { p_obra_id: obraId }));
}
