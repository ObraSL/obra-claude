import { r, type Db, type Respuesta } from "@/lib/datos/db";

/** Datos extra del alta: código de empresa existente, o código de alta + nombre de empresa nueva. */
export type MetaRegistro =
  | { empresa_codigo: string; nombre: string; apellidos: string }
  | { codigo_alta: string; nombre_empresa: string; nombre: string; apellidos: string };

/** Inicia sesión con email y contraseña. Usada en: Login. Spec: #95. */
export function iniciarSesion(db: Db, email: string, password: string): Promise<Respuesta<unknown>> {
  return r(db.auth.signInWithPassword({ email, password }));
}

/** Crea la cuenta (la meta decide empresa existente o nueva). Usada en: Login. Spec: #96. */
export function registrarse(db: Db, email: string, password: string, meta: MetaRegistro): Promise<Respuesta<unknown>> {
  return r(
    db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login`, data: meta },
    })
  );
}

/** Envía el enlace para restablecer la contraseña. Usada en: Login. Spec: #97. */
export function recuperarContrasena(db: Db, email: string): Promise<Respuesta<unknown>> {
  return r(db.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }));
}

/** Cambia la contraseña de la sesión actual. Usada en: ResetPassword. Spec: #98. */
export function cambiarContrasena(db: Db, password: string): Promise<Respuesta<unknown>> {
  return r(db.auth.updateUser({ password }));
}

/** Cierra la sesión. Usada en: Sidebar, gates, Ajustes, admin. Spec: #3. */
export function cerrarSesion(db: Db): Promise<Respuesta<unknown>> {
  return r(db.auth.signOut().then((x) => ({ data: null, error: x.error })));
}

/** Usuario actual (data.user). Usada en: MiembroProvider, EliminarObra. Spec: #2. */
export function usuarioActual(db: Db): Promise<Respuesta<{ user: { id: string; email?: string } | null }>> {
  return r(db.auth.getUser());
}

/** Sesión actual (data.session). Usada en: useSession, AuthGate. Spec: #1. */
export function sesionActual(db: Db): Promise<Respuesta<{ session: { user: { id: string; email?: string } } | null }>> {
  return r(db.auth.getSession());
}

/** Reautentica con la contraseña antes de borrar una obra. Usada en: EliminarObra. Spec: #95. */
export function reautenticar(db: Db, email: string, password: string): Promise<Respuesta<unknown>> {
  return r(db.auth.signInWithPassword({ email, password }));
}
