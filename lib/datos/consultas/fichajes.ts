import { r, type Db, type Respuesta } from "@/lib/datos/db";
import { monthBounds } from "@/lib/format";
import type { Fichaje, FichajeHistorial, Transporte } from "@/lib/types";

const CONFLICTO = "obra_id,trabajador_id,fecha";

export type CampoHora = "hora_entrada" | "hora_salida";

/** Upsert común de un fichaje por (obra, trabajador, día). */
function upsertFichaje(db: Db, payload: Record<string, unknown>): Promise<Respuesta<Fichaje>> {
  return r<Fichaje>(db.from("fichajes").upsert(payload, { onConflict: CONFLICTO }).select().single());
}

// ───────────── Lectura ─────────────

/** Fichajes de la obra en un día. Usada en: Fichajes cuadrilla. Spec: #32. */
export function fichajesDelDia(db: Db, obraId: string, fecha: string): Promise<Respuesta<Fichaje[]>> {
  return r<Fichaje[]>(db.from("fichajes").select("*").eq("obra_id", obraId).eq("fecha", fecha));
}

/** Fichajes del día en otras obras. Usada en: Fichajes cuadrilla. Spec: #33. */
export function fichajesDelDiaOtrasObras(db: Db, obraId: string, fecha: string): Promise<Respuesta<Fichaje[]>> {
  return r<Fichaje[]>(db.from("fichajes").select("*").neq("obra_id", obraId).eq("fecha", fecha));
}

/** Mi fichaje de un día en una obra. Usada en: MiFichaje, reconciliación offline. Spec: #34. */
export function miFichajeDelDia(db: Db, obraId: string, trabajadorId: string, fecha: string): Promise<Respuesta<Fichaje>> {
  return r<Fichaje>(db.from("fichajes").select("*").eq("obra_id", obraId).eq("trabajador_id", trabajadorId).eq("fecha", fecha).maybeSingle());
}

/** Fichaje de hoy del trabajador, sin filtro de obra (v1, con limit 1). Usada en: InicioTrabajador. Spec: #35. */
export function fichajeDeHoyDeTrabajador(db: Db, trabajadorId: string, fecha: string): Promise<Respuesta<Fichaje[]>> {
  return r<Fichaje[]>(db.from("fichajes").select("*").eq("trabajador_id", trabajadorId).eq("fecha", fecha).limit(1));
}

// v2: corrige DIS-05 (ver ENTREGA/00-inventario.md)
/** Todos los fichajes de hoy del trabajador (la UI elige el de la obra actual). Usada en: InicioTrabajador. Spec: DIS-05. */
export function fichajesDeHoyDelTrabajador(db: Db, trabajadorId: string, fecha: string): Promise<Respuesta<Fichaje[]>> {
  return r<Fichaje[]>(db.from("fichajes").select("*").eq("trabajador_id", trabajadorId).eq("fecha", fecha));
}

/** Horas del mes del trabajador en todas las obras. Usada en: MiFichaje, InicioTrabajador. Spec: #36. */
export function horasDelMesDeTrabajador(
  db: Db,
  trabajadorId: string,
  desde: string,
  hasta: string
): Promise<Respuesta<Pick<Fichaje, "hora_entrada" | "hora_salida">[]>> {
  return r(db.from("fichajes").select("hora_entrada,hora_salida").eq("trabajador_id", trabajadorId).gte("fecha", desde).lt("fecha", hasta));
}

// v2: corrige DIS-01 (ver ENTREGA/00-inventario.md)
/** Horas del mes completo de una obra. Usada en: InicioGestor (Horas del mes). Spec: DIS-01. */
export function horasDelMesDeObra(db: Db, obraId: string, mes: string): Promise<Respuesta<Pick<Fichaje, "fecha" | "hora_entrada" | "hora_salida">[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r(db.from("fichajes").select("fecha,hora_entrada,hora_salida").eq("obra_id", obraId).gte("fecha", desde).lt("fecha", hasta));
}

/** Cuántos han fichado entrada hoy (solo count). Usada en: InicioGestor. Spec: #37. */
export function contarFichadosHoy(db: Db, obraId: string, fecha: string): Promise<Respuesta<null>> {
  return r<null>(db.from("fichajes").select("id", { count: "exact", head: true }).eq("obra_id", obraId).eq("fecha", fecha).not("hora_entrada", "is", null));
}

/** Fichajes desde una fecha (hoy-13), sin tope. Usada en: InicioGestor. Spec: #38. */
export function fichajesUltimosDias(db: Db, obraId: string, desde: string): Promise<Respuesta<Pick<Fichaje, "fecha" | "hora_entrada" | "hora_salida">[]>> {
  return r(db.from("fichajes").select("fecha,hora_entrada,hora_salida").eq("obra_id", obraId).gte("fecha", desde));
}

/** Fichajes de la obra en un mes. Usada en: Resumen. Spec: #39. */
export function fichajesDeObraEnMes(db: Db, obraId: string, mes: string): Promise<Respuesta<Fichaje[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<Fichaje[]>(db.from("fichajes").select("*").eq("obra_id", obraId).gte("fecha", desde).lt("fecha", hasta));
}

/** Fichajes de un trabajador en un mes, todas las obras. Usada en: Resumen (detalle). Spec: #40. */
export function fichajesDeTrabajadorEnMes(db: Db, trabajadorId: string, mes: string): Promise<Respuesta<Fichaje[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<Fichaje[]>(db.from("fichajes").select("*").eq("trabajador_id", trabajadorId).gte("fecha", desde).lt("fecha", hasta).order("fecha"));
}

/** Historial de cambios de un fichaje. Usada en: CorregirHorasForm. Spec: #41. */
export function historialFichaje(db: Db, fichajeId: string): Promise<Respuesta<FichajeHistorial[]>> {
  return r<FichajeHistorial[]>(db.from("fichajes_historial").select("*").eq("fichaje_id", fichajeId).order("cambiado_en", { ascending: false }));
}

/** Historial de la obra en un mes (sin order). Usada en: Resumen. Spec: #42. */
export function historialDeObraEnMes(db: Db, obraId: string, mes: string): Promise<Respuesta<FichajeHistorial[]>> {
  const { desde, hasta } = monthBounds(mes);
  return r<FichajeHistorial[]>(db.from("fichajes_historial").select("*").eq("obra_id", obraId).gte("fecha", desde).lt("fecha", hasta));
}

// ───────────── Escritura ─────────────

/** Ficha entrada/salida de un trabajador (cuadrilla). Usada en: Fichajes cuadrilla. Spec: #43. */
export function ficharCampo(db: Db, obraId: string, trabajadorId: string, fecha: string, campo: CampoHora, hora: string): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, [campo]: hora });
}

/** Ficha con geovalla (ubicacion_ok y distancia siempre presentes). Usada en: MiFichaje. Spec: #44. */
export function ficharConGeovalla(
  db: Db,
  obraId: string,
  trabajadorId: string,
  fecha: string,
  campo: CampoHora,
  hora: string,
  ubicacionOk: boolean | null,
  distancia: number | null
): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, [campo]: hora, ubicacion_ok: ubicacionOk, distancia_metros: distancia });
}

/** Reintenta un fichaje de la cola offline (geovalla solo si definida). Usada en: offline-fichajes. Spec: #45. */
export function reintentarFichajePendiente(
  db: Db,
  item: { obra_id: string; trabajador_id: string; fecha: string; campo: CampoHora; hora: string; ubicacion_ok?: boolean | null; distancia_metros?: number | null }
): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, {
    obra_id: item.obra_id,
    trabajador_id: item.trabajador_id,
    fecha: item.fecha,
    [item.campo]: item.hora,
    ...(item.ubicacion_ok !== undefined ? { ubicacion_ok: item.ubicacion_ok } : {}),
    ...(item.distancia_metros !== undefined ? { distancia_metros: item.distancia_metros } : {}),
  });
}

/** Corrige las horas del día (hora_corregida = true). Usada en: CorregirHorasForm. Spec: #46. */
export function corregirHoras(
  db: Db,
  obraId: string,
  trabajadorId: string,
  fecha: string,
  entrada: string | null,
  salida: string | null
): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, hora_entrada: entrada, hora_salida: salida, hora_corregida: true });
}

/** Quita el día (v1: corregir con null,null). Usada en: CorregirHorasForm. Spec: #46. */
export function quitarDia(db: Db, obraId: string, trabajadorId: string, fecha: string): Promise<Respuesta<Fichaje>> {
  return corregirHoras(db, obraId, trabajadorId, fecha, null, null);
}

/** Mueve un fichaje a otra obra. Usada en: CorregirHorasForm. Spec: #47. */
export function moverFichajeDeObra(db: Db, fichajeId: string, nuevaObraId: string): Promise<Respuesta<Fichaje>> {
  return r<Fichaje>(db.from("fichajes").update({ obra_id: nuevaObraId }).eq("id", fichajeId).select().single());
}

/** Guarda la zona del fichaje. Usada en: Cuadrilla, MiFichaje. Spec: #48. */
export function guardarZonaFichaje(db: Db, obraId: string, trabajadorId: string, fecha: string, ubicacion: string | null): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, ubicacion });
}

/** Guarda el transporte (propio | traído por). Usada en: MiFichaje. Spec: #49. */
export function guardarTransporte(
  db: Db,
  obraId: string,
  trabajadorId: string,
  fecha: string,
  transporte: Transporte,
  traidoPor: string | null
): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, transporte, traido_por: traidoPor });
}

/** El trabajador confirma las horas corregidas. Usada en: MiFichaje. Spec: #50. */
export function confirmarHorasCorregidas(db: Db, obraId: string, trabajadorId: string, fecha: string): Promise<Respuesta<Fichaje>> {
  return upsertFichaje(db, { obra_id: obraId, trabajador_id: trabajadorId, fecha, confirmado_trabajador: true });
}
