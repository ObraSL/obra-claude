import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Miembro } from "@/lib/types";

/** Ajustes de la empresa (módulos activos, jornada). Sin fila = todo activado. */
export type AjustesFila = {
  owner_id: string;
  mod_vehiculos?: boolean;
  mod_notas_voz?: boolean;
  mod_caja_jefe?: boolean;
  mod_transporte?: boolean;
  mod_geolocalizacion?: boolean;
  jornada_horas?: number | null;
  jefe_ve_todas?: boolean;
  [clave: string]: unknown;
};

/** Mi fila de miembro. Usada en: MiembroProvider. Spec: inventario #4. */
export function leerMiMiembro(db: Db, userId: string): Promise<Respuesta<Miembro>> {
  return r<Miembro>(db.from("miembros").select("*").eq("user_id", userId).maybeSingle());
}

/** ¿Soy admin de la plataforma? (truthy = admin). Usada en: MiembroProvider, admin layout. Spec: #8. */
export function soyAdminPlataforma(db: Db): Promise<Respuesta<boolean>> {
  return r<boolean>(db.rpc("soy_admin_plataforma"));
}

/** Estado de la suscripción de mi empresa. Usada en: MiembroProvider. Spec: #9. */
export function leerEstadoSuscripcion(db: Db): Promise<Respuesta<{ activa_hasta: string | null; bloqueada: boolean }>> {
  return r(db.from("empresas").select("activa_hasta, bloqueada").maybeSingle());
}

/** Código de mi empresa (para invitar). Usada en: Accesos. Spec: #10. */
export function leerCodigoEmpresa(db: Db): Promise<Respuesta<{ codigo: string }>> {
  return r(db.from("empresas").select("codigo").limit(1).maybeSingle());
}

/** Ajustes de módulos. Usada en: MiembroProvider. Spec: #13. */
export function leerAjustes(db: Db): Promise<Respuesta<AjustesFila>> {
  return r<AjustesFila>(db.from("ajustes").select("*").limit(1).maybeSingle());
}

/** Jornada y visibilidad del jefe. Usada en: ObraProvider. Spec: #14. */
export function leerAjustesJornada(db: Db): Promise<Respuesta<{ jornada_horas: number | null; jefe_ve_todas: boolean }>> {
  return r(db.from("ajustes").select("jornada_horas,jefe_ve_todas").maybeSingle());
}

/** Guarda la jornada diaria en horas. Usada en: Ajustes. Spec: #15. */
export function guardarJornada(db: Db, userId: string, horas: number | null): Promise<Respuesta<unknown>> {
  return r(db.from("ajustes").upsert({ owner_id: userId, jornada_horas: horas, updated_at: new Date().toISOString() }));
}

/** Guarda si el jefe de obra ve todas las obras. Usada en: Ajustes. Spec: #16. */
export function guardarJefeVeTodas(db: Db, userId: string, valor: boolean): Promise<Respuesta<unknown>> {
  return r(db.from("ajustes").upsert({ owner_id: userId, jefe_ve_todas: valor, updated_at: new Date().toISOString() }));
}

/** Activa/desactiva un módulo (clave sin prefijo "mod_"). Usada en: Ajustes. Spec: #17. */
export function guardarModulo(db: Db, userId: string, clave: string, valor: boolean): Promise<Respuesta<unknown>> {
  return r(db.from("ajustes").upsert({ owner_id: userId, ["mod_" + clave]: valor, updated_at: new Date().toISOString() }));
}

/** Guarda mi nombre al esperar aprobación. Usada en: PendienteAprobacion. Spec: #11. */
export function guardarMiNombre(db: Db, nombre: string): Promise<Respuesta<unknown>> {
  return r(db.rpc("guardar_mi_nombre", { nuevo: nombre }));
}

/** Confirma la lectura del aviso de control (sin prefijo p_). Usada en: AvisoControl. Spec: #12. */
export function confirmarAvisoControl(db: Db, version: string): Promise<Respuesta<unknown>> {
  return r(db.rpc("confirmar_aviso_control", { version }));
}

/** Comprueba un código de registro (empresa o alta). Usada en: Login. Spec: #99. */
export function comprobarCodigoRegistro(db: Db, codigo: string): Promise<Respuesta<{ tipo: "empresa" | "alta"; nombre: string }[]>> {
  return r(db.rpc("comprobar_codigo_registro", { p_codigo: codigo.trim() }));
}
