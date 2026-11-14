import { r, type Db, type Respuesta } from "@/lib/datos/db";
import { monthBounds } from "@/lib/format";
import type { Gasto, UsoVehiculo } from "@/lib/types";

// Las consultas de fichajes del mes (#39, #40, #42) viven en fichajes.ts.

/** Gastos de la obra en un mes. Usada en: Resumen. Spec: #63. */
export function gastosDeObraEnMes(db: Db, obraId: string, mes: string): Promise<Respuesta<Gasto[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<Gasto[]>(db.from("gastos").select("*").eq("obra_id", obraId).gte("fecha", desde).lt("fecha", hasta));
}

/** Usos de vehículo de la obra en un mes. Usada en: Resumen. Spec: #57. */
export function usosVehiculoDeObraEnMes(db: Db, obraId: string, mes: string): Promise<Respuesta<UsoVehiculo[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<UsoVehiculo[]>(db.from("usos_vehiculo").select("*").eq("obra_id", obraId).gte("fecha", desde).lt("fecha", hasta));
}

/** Usos de un vehículo en un mes, todas las obras. Usada en: Resumen (detalle). Spec: #58. */
export function usosDeVehiculoEnMes(db: Db, vehiculoId: string, mes: string): Promise<Respuesta<UsoVehiculo[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<UsoVehiculo[]>(db.from("usos_vehiculo").select("*").eq("vehiculo_id", vehiculoId).gte("fecha", desde).lt("fecha", hasta).order("fecha"));
}
