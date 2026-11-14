import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { NotaAudio } from "@/lib/types";

/** Nota de voz de un día. Usada en: Notas. Spec: #87. */
export function notaDelDia(db: Db, obraId: string, fecha: string): Promise<Respuesta<NotaAudio>> {
  return r<NotaAudio>(db.from("notas_audio").select("*").eq("obra_id", obraId).eq("fecha", fecha).maybeSingle());
}

/** Últimas 12 notas de la obra. Usada en: Notas. Spec: #88. */
export function ultimasNotas(db: Db, obraId: string): Promise<Respuesta<NotaAudio[]>> {
  return r<NotaAudio[]>(db.from("notas_audio").select("*").eq("obra_id", obraId).order("fecha", { ascending: false }).limit(12));
}

/** Guarda (o reemplaza) la nota del día. Usada en: Notas. Spec: #89. */
export function guardarNota(
  db: Db,
  d: { obra_id: string; fecha: string; audio_path: string; duracion_seg: number | null }
): Promise<Respuesta<unknown>> {
  return r(
    db
      .from("notas_audio")
      .upsert({ obra_id: d.obra_id, fecha: d.fecha, audio_path: d.audio_path, duracion_seg: d.duracion_seg }, { onConflict: "obra_id,fecha" })
  );
}

/** Borra una nota (el audio se borra antes, aparte). Usada en: Notas. Spec: #90. */
export function borrarNota(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("notas_audio").delete().eq("id", id));
}
