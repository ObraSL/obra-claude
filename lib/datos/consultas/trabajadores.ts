import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Trabajador } from "@/lib/types";

/** Trabajadores activos. Usada en: Fichajes cuadrilla, Vehículos. Spec: #28. */
export function trabajadoresActivos(db: Db): Promise<Respuesta<Trabajador[]>> {
  return r<Trabajador[]>(db.from("trabajadores").select("*").eq("activo", true).order("nombre"));
}

/** Todos los trabajadores. Usada en: Resumen, Ajustes, Accesos. Spec: #29. */
export function trabajadoresTodos(db: Db): Promise<Respuesta<Trabajador[]>> {
  return r<Trabajador[]>(db.from("trabajadores").select("*").order("nombre"));
}

/** Crea un trabajador. Usada en: Fichajes, Ajustes, Accesos. Spec: #30. */
export function crearTrabajador(db: Db, userId: string, nombre: string): Promise<Respuesta<Trabajador>> {
  return r<Trabajador>(db.from("trabajadores").insert({ owner_id: userId, nombre }).select().single());
}

/** Activa o desactiva un trabajador. Usada en: Ajustes. Spec: #31. */
export function cambiarActivoTrabajador(db: Db, id: string, activo: boolean): Promise<Respuesta<Trabajador>> {
  return r<Trabajador>(db.from("trabajadores").update({ activo }).eq("id", id).select().single());
}
