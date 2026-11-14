/**
 * Autenticación en memoria: cuentas (auth.users), sesión y el trigger
 * `crear_miembro` que se dispara al registrarse (D §4.1).
 */
import { uuid, type Almacen, type UsuarioAuth } from "./almacen";
import {
  ErrorBD,
  insertarFila,
  actualizarFila,
  transaccion,
  type Ctx,
} from "./reglas";
import type { Entorno } from "./consulta";

export type ErrorAuth = { name: string; message: string; status: number; code: string };
export type EventoAuth = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";

export type UsuarioPublico = {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: { provider: string; providers: string[] };
  identities: unknown[];
  created_at: string;
};

export type SesionPublica = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  user: UsuarioPublico;
};

type RespuestaAuth = { data: Record<string, unknown>; error: ErrorAuth | null };

const errorAuth = (name: string, message: string, status: number, code: string): ErrorAuth => ({
  name,
  message,
  status,
  code,
});

const normalizar = (x: unknown) => String(x ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** El trigger on_auth_user_created → crear_miembro(). Lanza `raise exception` si el código no vale. */
export function crearMiembro(c: Ctx, u: UsuarioAuth): void {
  const meta = u.meta;
  const codEmpresa = normalizar(meta.empresa_codigo);
  const codAlta = normalizar(meta.codigo_alta);
  const persona = `${meta.nombre ?? ""} ${meta.apellidos ?? ""}`.trim() || null;
  const t = c.almacen.tablas;

  if (codEmpresa !== "") {
    const e = t.empresas.find((x) => String(x.codigo).toUpperCase() === codEmpresa && !x.bloqueada);
    if (!e) throw new ErrorBD("codigo_empresa_invalido", "P0001");
    if (!t.miembros.some((m) => m.user_id === u.id)) {
      insertarFila(
        c,
        "miembros",
        { user_id: u.id, email: u.email, nombre: persona, rol: "trabajador", aprobado: false, empresa_id: e.id },
        "sistema",
      );
    }
  } else if (codAlta !== "") {
    const alta = t.codigos_alta.find(
      (x) => String(x.codigo).replace(/-/g, "").toUpperCase() === codAlta && x.usado_en == null && x.cancelado_en == null,
    );
    if (!alta) throw new ErrorBD("codigo_alta_invalido", "P0001");
    const usada = actualizarFila(c, "codigos_alta", alta, { usado_en: c.ahora.toISOString(), usado_por: u.id }, "sistema");
    const nombreEmpresa = String(meta.nombre_empresa ?? "").trim() || "Mi empresa";
    const hasta = alta.pagado_hasta ?? new Date(c.ahora.getTime() + 14 * 86400000).toISOString();
    const empresa = insertarFila(c, "empresas", { nombre: nombreEmpresa, activa_hasta: hasta }, "sistema");
    actualizarFila(c, "codigos_alta", usada, { empresa_id: empresa.id }, "sistema");
    if (!t.miembros.some((m) => m.user_id === u.id)) {
      insertarFila(
        c,
        "miembros",
        { user_id: u.id, email: u.email, nombre: persona, rol: "dueno", aprobado: true, empresa_id: empresa.id },
        "sistema",
      );
    }
  } else {
    throw new ErrorBD("codigo_requerido", "P0001");
  }
}

/** Marca como confirmado el e-mail de una cuenta (para tests y la galería: no hay bandeja de entrada). */
export function confirmarEmail(almacen: Almacen, email: string): boolean {
  const u = almacen.usuarios.find((x) => x.email === email.trim().toLowerCase());
  if (!u) return false;
  u.confirmado = true;
  return true;
}

function usuarioPublico(u: UsuarioAuth): UsuarioPublico {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.confirmado ? u.created_at : null,
    user_metadata: { ...u.meta },
    app_metadata: { provider: "email", providers: ["email"] },
    identities: [{ identity_id: u.id, user_id: u.id, provider: "email" }],
    created_at: u.created_at,
  };
}

function sesionPublica(u: UsuarioAuth, ahora: Date): SesionPublica {
  return {
    access_token: `demo.${u.id}.${ahora.getTime()}`,
    refresh_token: `demo-refresh-${u.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(ahora.getTime() / 1000) + 3600,
    user: usuarioPublico(u),
  };
}

export type ClienteAuthMemoria = {
  getSession: () => Promise<RespuestaAuth>;
  getUser: () => Promise<RespuestaAuth>;
  onAuthStateChange: (cb: (evento: EventoAuth, sesion: SesionPublica | null) => void) => {
    data: { subscription: { id: string; unsubscribe: () => void } };
  };
  signInWithPassword: (p: { email: string; password: string }) => Promise<RespuestaAuth>;
  signUp: (p: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) => Promise<RespuestaAuth>;
  signOut: () => Promise<{ error: ErrorAuth | null }>;
  resetPasswordForEmail: (email: string, opciones?: { redirectTo?: string }) => Promise<RespuestaAuth>;
  updateUser: (p: { password?: string; data?: Record<string, unknown> }) => Promise<RespuestaAuth>;
};

/** Sesión de ESTE cliente (cada cliente tiene la suya; la del almacén es la que se persiste). */
export type EstadoSesion = { sesion: { user_id: string } | null };

export function crearAuth(entorno: Entorno, almacen: Almacen, reloj: () => Date, estado: EstadoSesion): ClienteAuthMemoria {
  const oyentes = new Map<string, (evento: EventoAuth, sesion: SesionPublica | null) => void>();

  const usuarioActual = (): UsuarioAuth | null => {
    const s = estado.sesion;
    return s ? (almacen.usuarios.find((u) => u.id === s.user_id) ?? null) : null;
  };
  const sesionActual = (): SesionPublica | null => {
    const u = usuarioActual();
    return u ? sesionPublica(u, reloj()) : null;
  };
  const emitir = (evento: EventoAuth) => {
    const sesion = sesionActual();
    for (const cb of [...oyentes.values()]) {
      Promise.resolve().then(() => cb(evento, sesion));
    }
  };

  const fallo = (data: Record<string, unknown>) => (mensaje: string): RespuestaAuth => ({
    data,
    error: errorAuth("AuthRetryableFetchError", mensaje, 0, ""),
  });
  const vacio = { user: null, session: null };
  const sinSesion = errorAuth("AuthSessionMissingError", "Auth session missing!", 400, "session_not_found");

  return {
    // En supabase-js getSession lee del almacenamiento local: funciona aunque la red falle.
    async getSession() {
      return { data: { session: sesionActual() }, error: null };
    },

    getUser() {
      return entorno.correr<RespuestaAuth>(
        () => {
          const u = usuarioActual();
          return u ? { data: { user: usuarioPublico(u) }, error: null } : { data: { user: null }, error: sinSesion };
        },
        fallo({ user: null }),
        false,
      );
    },

    onAuthStateChange(cb) {
      const id = uuid();
      oyentes.set(id, cb);
      // supabase-js avisa del estado inicial nada más suscribirse.
      Promise.resolve().then(() => {
        if (oyentes.has(id)) cb("INITIAL_SESSION", sesionActual());
      });
      return { data: { subscription: { id, unsubscribe: () => void oyentes.delete(id) } } };
    },

    signInWithPassword({ email, password }) {
      return entorno.correr<RespuestaAuth>(
        (c) => {
          const u = almacen.usuarios.find((x) => x.email === String(email ?? "").trim().toLowerCase());
          if (!u || u.password !== password) {
            return { data: vacio, error: errorAuth("AuthApiError", "Invalid login credentials", 400, "invalid_credentials") };
          }
          if (!u.confirmado) {
            return { data: vacio, error: errorAuth("AuthApiError", "Email not confirmed", 400, "email_not_confirmed") };
          }
          estado.sesion = { user_id: u.id };
          almacen.sesion = estado.sesion;
          emitir("SIGNED_IN");
          return { data: { user: usuarioPublico(u), session: sesionPublica(u, c.ahora) }, error: null };
        },
        fallo(vacio),
        true,
      );
    },

    signUp({ email, password, options }) {
      return entorno.correr<RespuestaAuth>(
        (c) => {
          const mail = String(email ?? "").trim().toLowerCase();
          if (!mail || !/^[^\s@]+@[^\s@]+$/.test(mail)) {
            return { data: vacio, error: errorAuth("AuthApiError", `Unable to validate email address: invalid format`, 400, "validate_failed") };
          }
          if (typeof password !== "string" || password.length < 6) {
            return { data: vacio, error: errorAuth("AuthWeakPasswordError", "Password should be at least 6 characters.", 422, "weak_password") };
          }
          if (almacen.usuarios.some((x) => x.email === mail)) {
            // Con confirmación de e-mail activa, GoTrue no revela que la cuenta existe.
            const falso: UsuarioPublico = {
              id: uuid(),
              aud: "authenticated",
              role: "",
              email: mail,
              email_confirmed_at: null,
              user_metadata: {},
              app_metadata: { provider: "email", providers: ["email"] },
              identities: [],
              created_at: c.ahora.toISOString(),
            };
            return { data: { user: falso, session: null }, error: null };
          }
          const usuario: UsuarioAuth = {
            id: uuid(),
            email: mail,
            password,
            confirmado: false,
            meta: { ...(options?.data ?? {}) },
            created_at: c.ahora.toISOString(),
          };
          try {
            transaccion(c, () => {
              almacen.usuarios.push(usuario);
              crearMiembro(c, usuario);
            });
          } catch (e) {
            const mensaje = e instanceof Error ? e.message : String(e);
            return { data: vacio, error: errorAuth("AuthApiError", mensaje, 500, "unexpected_failure") };
          }
          return { data: { user: usuarioPublico(usuario), session: null }, error: null };
        },
        fallo(vacio),
        true,
      );
    },

    signOut() {
      return entorno.correr<{ error: ErrorAuth | null }>(
        () => {
          estado.sesion = null;
          almacen.sesion = null;
          emitir("SIGNED_OUT");
          return { error: null };
        },
        (m) => ({ error: errorAuth("AuthRetryableFetchError", m, 0, "") }),
        true,
      );
    },

    resetPasswordForEmail() {
      return entorno.correr<RespuestaAuth>(() => ({ data: {}, error: null }), fallo({}), false);
    },

    updateUser({ password, data }) {
      return entorno.correr<RespuestaAuth>(
        () => {
          const u = usuarioActual();
          if (!u) return { data: { user: null }, error: sinSesion };
          if (password !== undefined) {
            if (password.length < 6) {
              return { data: { user: null }, error: errorAuth("AuthWeakPasswordError", "Password should be at least 6 characters.", 422, "weak_password") };
            }
            if (password === u.password) {
              return {
                data: { user: null },
                error: errorAuth("AuthApiError", "New password should be different from the old password.", 422, "same_password"),
              };
            }
            u.password = password;
          }
          if (data) u.meta = { ...u.meta, ...data };
          emitir("USER_UPDATED");
          return { data: { user: usuarioPublico(u) }, error: null };
        },
        fallo({ user: null }),
        true,
      );
    },
  };
}
