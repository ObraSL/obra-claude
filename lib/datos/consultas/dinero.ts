import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Cobro, Entrega } from "@/lib/types";

/** Cobros de una obra, el más reciente primero. Usada en: Dinero. Spec: #73. */
export function cobrosDeObra(db: Db, obraId: string): Promise<Respuesta<Cobro[]>> {
  return r<Cobro[]>(db.from("cobros").select("*").eq("obra_id", obraId).order("fecha", { ascending: false }));
}

/** Solo los importes de cobros (dueño/manager). Usada en: InicioGestor. Spec: #74. */
export function cobrosImportes(db: Db, obraId: string): Promise<Respuesta<Pick<Cobro, "importe">[]>> {
  return r(db.from("cobros").select("importe").eq("obra_id", obraId));
}

/** Crea un cobro. Usada en: Dinero. Spec: #75. */
export function crearCobro(
  db: Db,
  d: { obra_id: string; importe: number; fecha: string; concepto: string | null; archivo_path: string | null; archivo_tipo: string | null }
): Promise<Respuesta<unknown>> {
  return r(
    db.from("cobros").insert({
      obra_id: d.obra_id,
      importe: d.importe,
      fecha: d.fecha,
      concepto: d.concepto || null,
      archivo_path: d.archivo_path,
      archivo_tipo: d.archivo_tipo,
    })
  );
}

/** Borra un cobro (el archivo se borra antes, aparte). Usada en: Dinero. Spec: #76. */
export function borrarCobro(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("cobros").delete().eq("id", id));
}

/** Entregas del jefe, todas las obras (solo dueño). Usada en: Dinero. Spec: #77. */
export function entregas(db: Db): Promise<Respuesta<Entrega[]>> {
  return r<Entrega[]>(db.from("entregas").select("*").order("fecha", { ascending: false }));
}

/** Crea una entrega (userId = user_id del miembro dueño). Usada en: Dinero. Spec: #78. */
export function crearEntrega(
  db: Db,
  userId: string,
  d: { importe: number; fecha: string; concepto: string | null; obra_id: string | null }
): Promise<Respuesta<unknown>> {
  return r(
    db.from("entregas").insert({
      owner_id: userId,
      importe: d.importe,
      fecha: d.fecha,
      concepto: d.concepto || null,
      obra_id: d.obra_id || null,
    })
  );
}

/** Borra una entrega. Usada en: Dinero. Spec: #79. */
export function borrarEntrega(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("entregas").delete().eq("id", id));
}

/** Presupuestos de las tareas de la obra (para el balance). Usada en: Dinero. Spec: #81. */
export function presupuestosTareas(db: Db, obraId: string): Promise<Respuesta<{ presupuesto: number | null }[]>> {
  return r(db.from("tareas").select("presupuesto").eq("obra_id", obraId));
}
