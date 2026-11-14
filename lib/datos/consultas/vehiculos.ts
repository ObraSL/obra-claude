import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { UsoVehiculo, Vehiculo } from "@/lib/types";

/** Vehículos activos. Usada en: Vehículos. Spec: #51. */
export function vehiculosActivos(db: Db): Promise<Respuesta<Vehiculo[]>> {
  return r<Vehiculo[]>(db.from("vehiculos").select("*").eq("activo", true).order("nombre"));
}

/** Todos los vehículos. Usada en: Resumen, Ajustes. Spec: #52. */
export function vehiculosTodos(db: Db): Promise<Respuesta<Vehiculo[]>> {
  return r<Vehiculo[]>(db.from("vehiculos").select("*").order("nombre"));
}

/** Crea un vehículo. Usada en: Vehículos, Ajustes. Spec: #53. */
export function crearVehiculo(db: Db, userId: string, nombre: string): Promise<Respuesta<Vehiculo>> {
  return r<Vehiculo>(db.from("vehiculos").insert({ owner_id: userId, nombre }).select().single());
}

/** Activa o desactiva un vehículo. Usada en: Ajustes. Spec: #54. */
export function cambiarActivoVehiculo(db: Db, id: string, activo: boolean): Promise<Respuesta<Vehiculo>> {
  return r<Vehiculo>(db.from("vehiculos").update({ activo }).eq("id", id).select().single());
}

/** Usos de vehículo del día, todas las obras. Usada en: Vehículos. Spec: #55. */
export function usosVehiculoDelDia(db: Db, fecha: string): Promise<Respuesta<UsoVehiculo[]>> {
  return r<UsoVehiculo[]>(db.from("usos_vehiculo").select("*").eq("fecha", fecha).order("created_at"));
}

/** Vehículos usados hoy en la obra. Usada en: InicioGestor. Spec: #56. */
export function usosVehiculoDelDiaDeObra(db: Db, obraId: string, fecha: string): Promise<Respuesta<Pick<UsoVehiculo, "vehiculo_id">[]>> {
  return r(db.from("usos_vehiculo").select("vehiculo_id").eq("obra_id", obraId).eq("fecha", fecha));
}

/** Apunta un uso de vehículo (error 23505 = ya apuntado ese día en esa obra). Usada en: Vehículos. Spec: #59. */
export function crearUsoVehiculo(
  db: Db,
  d: { vehiculo_id: string; fecha: string; obra_id: string; conductor_id: string | null; destino: string | null }
): Promise<Respuesta<unknown>> {
  return r(
    db.from("usos_vehiculo").insert({
      vehiculo_id: d.vehiculo_id,
      fecha: d.fecha,
      obra_id: d.obra_id,
      conductor_id: d.conductor_id || null,
      destino: d.destino || null,
    })
  );
}

/** Cambia obra, conductor y destino de un uso. Usada en: Vehículos. Spec: #60. */
export function actualizarUsoVehiculo(
  db: Db,
  id: string,
  d: { obra_id: string; conductor_id: string | null; destino: string | null }
): Promise<Respuesta<unknown>> {
  return r(db.from("usos_vehiculo").update({ obra_id: d.obra_id, conductor_id: d.conductor_id, destino: d.destino }).eq("id", id));
}

/** Borra un uso de vehículo. Usada en: Vehículos. Spec: #61. */
export function borrarUsoVehiculo(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("usos_vehiculo").delete().eq("id", id));
}
