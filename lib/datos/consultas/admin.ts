import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { CodigoAlta, EmpresaAdmin, ErrorApp } from "@/lib/types";

/** Todas las empresas (admin de la plataforma). Usada en: Admin. Spec: #101. */
export function listarEmpresasAdmin(db: Db): Promise<Respuesta<EmpresaAdmin[]>> {
  return r<EmpresaAdmin[]>(db.rpc("listar_empresas_admin"));
}

/** Códigos de alta. Usada en: Admin. Spec: #102. */
export function listarCodigosAlta(db: Db): Promise<Respuesta<CodigoAlta[]>> {
  return r<CodigoAlta[]>(db.rpc("listar_codigos_alta"));
}

/** Últimos errores de la app (límite 100 por defecto). Usada en: Admin. Spec: #103. */
export function listarErroresAdmin(db: Db, limite = 100): Promise<Respuesta<ErrorApp[]>> {
  return r<ErrorApp[]>(db.rpc("listar_errores_admin", { p_limite: limite }));
}

/** Crea un código de alta; devuelve el código. Usada en: Admin. Spec: #104. */
export function crearCodigoAlta(db: Db, nota: string | null): Promise<Respuesta<string>> {
  return r<string>(db.rpc("crear_codigo_alta", { p_nota: nota }));
}

/** Cancela un código de alta. Usada en: Admin. Spec: #105. */
export function cancelarCodigoAlta(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.rpc("cancelar_codigo_alta", { p_id: id }));
}

/** Fija caducidad y bloqueo de una empresa. Usada en: Admin. Spec: #106. */
export function establecerSuscripcion(db: Db, empresaId: string, hasta: string | null, bloqueada: boolean): Promise<Respuesta<unknown>> {
  return r(db.rpc("establecer_suscripcion", { p_empresa: empresaId, p_activa_hasta: hasta, p_bloqueada: bloqueada }));
}

/** Borra todos los errores guardados. Usada en: Admin. Spec: #107. */
export function borrarErroresAdmin(db: Db): Promise<Respuesta<unknown>> {
  return r(db.rpc("borrar_errores_admin"));
}
