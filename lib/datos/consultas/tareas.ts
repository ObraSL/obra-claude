import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Tarea } from "@/lib/types";

/** Campos editables de una tarea. */
export type CamposTarea = {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  avance: number;
  presupuesto: number | null;
};

/** Fila de tarea para el alta (el orden lo calcula quien llama: max+1 o 0). */
export type NuevaTarea = CamposTarea & { obra_id: string; orden: number };

/** Tareas de una obra por orden y fecha. Usada en: Home, Planificación. Spec: #80. */
export function tareasDeObra(db: Db, obraId: string): Promise<Respuesta<Tarea[]>> {
  return r<Tarea[]>(db.from("tareas").select("*").eq("obra_id", obraId).order("orden").order("fecha_inicio"));
}

/** Crea una tarea. Usada en: Planificación. Spec: #82. */
export function crearTarea(db: Db, d: NuevaTarea): Promise<Respuesta<unknown>> {
  return r(
    db.from("tareas").insert({
      obra_id: d.obra_id,
      nombre: d.nombre,
      fecha_inicio: d.fecha_inicio,
      fecha_fin: d.fecha_fin,
      avance: d.avance,
      presupuesto: d.presupuesto,
      orden: d.orden,
    })
  );
}

/** Actualiza una tarea. Usada en: Planificación. Spec: #83. */
export function actualizarTarea(db: Db, id: string, d: CamposTarea): Promise<Respuesta<unknown>> {
  return r(
    db
      .from("tareas")
      .update({ nombre: d.nombre, fecha_inicio: d.fecha_inicio, fecha_fin: d.fecha_fin, avance: d.avance, presupuesto: d.presupuesto })
      .eq("id", id)
  );
}

/** Borra una tarea. Usada en: Planificación. Spec: #84. */
export function borrarTarea(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("tareas").delete().eq("id", id));
}

/** Borra todas las tareas de la obra (importar Excel; no atómico con crearTareas). Usada en: Import Excel. Spec: #85. */
export function borrarTareasDeObra(db: Db, obraId: string): Promise<Respuesta<unknown>> {
  return r(db.from("tareas").delete().eq("obra_id", obraId));
}

/** Inserta varias tareas de golpe (avance 0 lo pone quien llama). Usada en: Import Excel. Spec: #86. */
export function crearTareas(db: Db, filas: (NuevaTarea)[]): Promise<Respuesta<unknown>> {
  return r(db.from("tareas").insert(filas));
}
