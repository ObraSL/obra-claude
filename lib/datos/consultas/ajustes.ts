import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Miembro, Rol, SoporteAcceso } from "@/lib/types";

// Las listas maestras de trabajadores y vehículos (crear / activar) están en
// trabajadores.ts y vehiculos.ts; los ajustes de módulos en sesion.ts.

/** Cambios admitidos sobre un miembro (rol, obra, ficha de trabajador, aprobación). */
export type CambiosMiembro = { rol?: Rol; obra_id?: string | null; trabajador_id?: string | null; aprobado?: boolean };

/** Todas las cuentas de la empresa. Usada en: Accesos. Spec: #5. */
export function listarMiembros(db: Db): Promise<Respuesta<Miembro[]>> {
  return r<Miembro[]>(db.from("miembros").select("*").order("created_at", { ascending: true }));
}

/** Cambia rol, obra, ficha o aprobación de un miembro. Usada en: Accesos. Spec: #6. */
export function actualizarMiembro(db: Db, userId: string, cambios: CambiosMiembro): Promise<Respuesta<Miembro>> {
  return r<Miembro>(db.from("miembros").update(cambios).eq("user_id", userId).select().single());
}

/** Quita a un miembro de la empresa. Usada en: Accesos. Spec: #7. */
export function eliminarMiembro(db: Db, userId: string): Promise<Respuesta<unknown>> {
  return r(db.from("miembros").delete().eq("user_id", userId));
}

/** Accesos de soporte dados. Usada en: SoporteAcceso. Spec: #18. */
export function listarAccesosSoporte(db: Db): Promise<Respuesta<SoporteAcceso[]>> {
  return r<SoporteAcceso[]>(db.from("soporte_accesos").select("*").order("otorgado_en", { ascending: false }));
}

/** Da acceso de soporte durante unas horas (sin prefijo p_). Usada en: SoporteAcceso. Spec: #19. */
export function darAccesoSoporte(db: Db, email: string, horas: number): Promise<Respuesta<unknown>> {
  return r(db.rpc("dar_acceso_soporte", { email_soporte: email, horas }));
}

/** Revoca un acceso de soporte. Usada en: SoporteAcceso. Spec: #20. */
export function revocarAccesoSoporte(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.rpc("revocar_acceso_soporte", { acceso_id: id }));
}
