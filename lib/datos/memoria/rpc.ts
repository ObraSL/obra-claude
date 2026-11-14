/**
 * Las funciones RPC de la base de datos (sección 5 de D-base-de-datos.md).
 * Las SECURITY DEFINER saltan el RLS (modo "sistema"), pero los triggers
 * siguen disparándose y auth.uid() sigue siendo quien llama.
 */
import { diasEntre, type Fila } from "./almacen";
import {
  ErrorBD,
  aPlano,
  borrarFila,
  coaccionar,
  excepcion,
  identidad,
  insertarFila,
  puedeVerObra,
  soyAdmin,
  transaccion,
  actualizarFila,
  type Ctx,
} from "./reglas";
import {
  estadoDeError,
  resultadoDeFallo,
  type Entorno,
  type Resultado,
} from "./consulta";
import { ESQUEMA } from "./almacen";

type Args = Record<string, unknown>;

const NOAUTORIZADO = "no autorizado";
const ALFABETO_ALTA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** RPC que no modifican nada (el modo demo no persiste tras ellas). */
export const RPC_SOLO_LECTURA = new Set([
  "soy_admin_plataforma",
  "comprobar_codigo_registro",
  "avance_obra",
  "listar_empresas_admin",
  "listar_codigos_alta",
  "listar_errores_admin",
  "nombre_empresa_por_codigo",
]);

const SOLO_SERVICIO = new Set(["registrar_pago_alta", "actualizar_pago_suscripcion", "generar_codigo_alta_libre"]);

const normalizar = (x: unknown) => String(x ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const t = (c: Ctx, nombre: Parameters<typeof insertarFila>[1]) => c.almacen.tablas[nombre];
const ms = (v: unknown) => Date.parse(String(v));
const ahoraISO = (c: Ctx) => c.ahora.toISOString();
const recorta = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));

export function generarCodigoAltaLibre(c: Ctx): string {
  for (;;) {
    const parte = () =>
      Array.from({ length: 4 }, () => ALFABETO_ALTA[Math.floor(Math.random() * ALFABETO_ALTA.length)]).join("");
    const codigo = `${parte()}-${parte()}-${parte()}`;
    if (!t(c, "codigos_alta").some((x) => x.codigo === codigo)) return codigo;
  }
}

function exigirAdminMutador(c: Ctx) {
  if (!soyAdmin(c)) throw excepcion(NOAUTORIZADO);
}

const masReciente = (campo: string) => (a: Fila, b: Fila) => ms(b[campo]) - ms(a[campo]);

function llamar(c: Ctx, nombre: string, a: Args): unknown {
  switch (nombre) {
    case "soy_admin_plataforma":
      return soyAdmin(c);

    case "guardar_mi_nombre": {
      if (!c.uid) return null;
      const nuevo = a.nuevo === undefined ? null : a.nuevo;
      const m = t(c, "miembros").find((x) => x.user_id === c.uid);
      if (m) {
        actualizarFila(c, "miembros", m, { nombre: nuevo }, "sistema");
      } else {
        const u = c.almacen.usuarios.find((x) => x.id === c.uid);
        insertarFila(c, "miembros", { user_id: c.uid, email: u?.email ?? "", nombre: nuevo, rol: "trabajador", aprobado: false }, "sistema");
      }
      return null;
    }

    case "confirmar_aviso_control": {
      if (!c.uid) return null;
      const m = t(c, "miembros").find((x) => x.user_id === c.uid);
      if (m) {
        actualizarFila(
          c,
          "miembros",
          m,
          { aviso_control_leido_en: ahoraISO(c), aviso_control_version: a.version === undefined ? null : a.version },
          "sistema",
        );
      }
      return null;
    }

    case "comprobar_codigo_registro": {
      const norm = normalizar(a.p_codigo);
      if (norm === "") return [];
      const e = t(c, "empresas").find((x) => String(x.codigo).toUpperCase() === norm && !x.bloqueada);
      if (e) return [{ tipo: "empresa", nombre: e.nombre }];
      const alta = t(c, "codigos_alta").find(
        (x) => String(x.codigo).replace(/-/g, "").toUpperCase() === norm && x.usado_en == null && x.cancelado_en == null,
      );
      if (alta) return [{ tipo: "alta", nombre: null }];
      return [];
    }

    case "nombre_empresa_por_codigo": {
      const e = t(c, "empresas").find((x) => x.codigo === a.p_codigo);
      return e ? e.nombre : null;
    }

    case "avance_obra": {
      const id = coaccionar(ESQUEMA.obras.cols.id, a.o_id);
      if (!puedeVerObra(c, id)) return null;
      let suma = 0;
      let pesos = 0;
      for (const x of t(c, "tareas")) {
        if (x.obra_id !== id) continue;
        const dias = diasEntre(String(x.fecha_inicio), String(x.fecha_fin)) + 1;
        suma += dias * Number(x.avance);
        pesos += dias;
      }
      return pesos === 0 ? 0 : suma / pesos;
    }

    case "eliminar_obra": {
      const i = identidad(c);
      if (i.rol !== "dueno") throw excepcion("Solo el dueño puede borrar una obra definitivamente.");
      const id = coaccionar(ESQUEMA.obras.cols.id, a.p_obra_id);
      const obra = t(c, "obras").find((o) => o.id === id && i.empresaId !== null && o.empresa_id === i.empresaId);
      if (!obra) throw excepcion("Esa obra no existe o no es de esta empresa.");
      for (const h of t(c, "fichajes_historial")) {
        if (h.obra_id_antes === id) h.obra_id_antes = null;
        if (h.obra_id_despues === id) h.obra_id_despues = null;
      }
      const fichajeIds = new Set(t(c, "fichajes").filter((f) => f.obra_id === id).map((f) => f.id));
      for (const h of t(c, "fichajes_historial").filter((x) => fichajeIds.has(x.fichaje_id))) {
        borrarFila(c, "fichajes_historial", h, "sistema");
      }
      for (const tabla of ["fichajes", "usos_vehiculo", "gastos", "facturas", "cobros", "notas_audio", "tareas"] as const) {
        for (const f of t(c, tabla).filter((x) => x.obra_id === id)) borrarFila(c, tabla, f, "sistema");
      }
      borrarFila(c, "obras", obra, "sistema");
      return null;
    }

    case "dar_acceso_soporte": {
      const i = identidad(c);
      if (i.rol !== "dueno") throw excepcion("Solo el dueño puede dar acceso de soporte.");
      const horas = a.horas === undefined ? 24 : a.horas;
      if (horas === null || typeof horas !== "number" || !(horas > 0) || horas > 720) {
        throw excepcion("Las horas tienen que ser entre 1 y 720 (30 días).");
      }
      const mail = String(a.email_soporte ?? "").toLowerCase();
      const usuario = c.almacen.usuarios.find((u) => u.email.toLowerCase() === mail);
      if (!usuario) throw excepcion("Esa cuenta todavía no existe: tiene que registrarse primero en la app.");
      const existente = t(c, "miembros").find((m) => m.user_id === usuario.id);
      if (existente && !existente.es_soporte) {
        throw excepcion("Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.");
      }
      if (existente) {
        actualizarFila(c, "miembros", existente, { empresa_id: i.empresaId, rol: "dueno", aprobado: true, es_soporte: true }, "sistema");
      } else {
        insertarFila(
          c,
          "miembros",
          { user_id: usuario.id, email: usuario.email, rol: "dueno", aprobado: true, empresa_id: i.empresaId, es_soporte: true },
          "sistema",
        );
      }
      insertarFila(
        c,
        "soporte_accesos",
        {
          empresa_id: i.empresaId,
          otorgado_a: usuario.id,
          email: usuario.email,
          otorgado_por: c.uid,
          expira_en: new Date(c.ahora.getTime() + horas * 3600000).toISOString(),
        },
        "sistema",
      );
      return null;
    }

    case "revocar_acceso_soporte": {
      const i = identidad(c);
      if (i.rol !== "dueno") throw excepcion("Solo el dueño puede quitar el acceso de soporte.");
      const id = coaccionar(ESQUEMA.soporte_accesos.cols.id, a.acceso_id);
      const acceso = t(c, "soporte_accesos").find((s) => s.id === id && s.empresa_id === i.empresaId && s.revocado_en == null);
      if (acceso) {
        actualizarFila(c, "soporte_accesos", acceso, { revocado_en: ahoraISO(c), revocado_por: c.uid }, "sistema");
        const m = t(c, "miembros").find((x) => x.user_id === acceso.otorgado_a && x.es_soporte && x.empresa_id === i.empresaId);
        if (m) borrarFila(c, "miembros", m, "sistema");
      }
      return null;
    }

    case "registrar_error": {
      const hace1h = c.ahora.getTime() - 3600000;
      if (t(c, "errores_app").filter((e) => ms(e.creado_en) > hace1h).length >= 300) return null;
      const mensaje = String(a.p_mensaje ?? "").trim();
      insertarFila(
        c,
        "errores_app",
        {
          origen: a.p_origen === "servidor" ? "servidor" : "navegador",
          mensaje: mensaje === "" ? "(sin mensaje)" : mensaje.slice(0, 500),
          detalle: recorta(a.p_detalle, 4000),
          ruta: recorta(a.p_ruta, 300),
          navegador: recorta(a.p_navegador, 300),
          user_id: c.uid,
          empresa_id: identidad(c).empresaId,
        },
        "sistema",
      );
      if (Math.random() < 0.02) {
        const corte = c.almacen.tablas.errores_app;
        const limite = c.ahora.getTime() - 90 * 86400000;
        c.almacen.tablas.errores_app = corte.filter((e) => ms(e.creado_en) >= limite);
      }
      return null;
    }

    case "listar_empresas_admin": {
      if (!soyAdmin(c)) return [];
      return [...t(c, "empresas")].sort(masReciente("created_at")).map((e) => ({
        id: e.id,
        nombre: e.nombre,
        codigo: e.codigo,
        created_at: e.created_at,
        miembros_count: t(c, "miembros").filter((m) => m.empresa_id === e.id && !m.es_soporte).length,
        obras_count: t(c, "obras").filter((o) => o.empresa_id === e.id).length,
        activa_hasta: e.activa_hasta,
        bloqueada: e.bloqueada,
        codigo_alta: t(c, "codigos_alta").find((x) => x.empresa_id === e.id)?.codigo ?? null,
      }));
    }

    case "listar_codigos_alta": {
      if (!soyAdmin(c)) return [];
      return [...t(c, "codigos_alta")].sort(masReciente("creado_en")).map((x) => ({
        id: x.id,
        codigo: x.codigo,
        nota: x.nota,
        creado_en: x.creado_en,
        estado: x.usado_en != null ? "usado" : x.cancelado_en != null ? "cancelado" : "libre",
        empresa_nombre: t(c, "empresas").find((e) => e.id === x.empresa_id)?.nombre ?? null,
        usado_en: x.usado_en,
        email: x.email,
        pagado: x.stripe_session_id != null,
      }));
    }

    case "listar_errores_admin": {
      if (!soyAdmin(c)) return [];
      const pedido = a.p_limite === undefined ? 100 : Number(a.p_limite);
      const limite = Math.min(Math.max(Number.isFinite(pedido) ? pedido : 100, 1), 500);
      return [...t(c, "errores_app")]
        .sort((x, y) => ms(y.creado_en) - ms(x.creado_en) || Number(y.id) - Number(x.id))
        .slice(0, limite)
        .map((e) => ({
          id: e.id,
          creado_en: e.creado_en,
          origen: e.origen,
          mensaje: e.mensaje,
          detalle: e.detalle,
          ruta: e.ruta,
          navegador: e.navegador,
          email: c.almacen.usuarios.find((u) => u.id === e.user_id)?.email ?? null,
          empresa: t(c, "empresas").find((x) => x.id === e.empresa_id)?.nombre ?? null,
        }));
    }

    case "crear_codigo_alta": {
      exigirAdminMutador(c);
      const codigo = generarCodigoAltaLibre(c);
      const nota = a.p_nota == null ? "" : String(a.p_nota).trim();
      insertarFila(c, "codigos_alta", { codigo, nota: nota === "" ? null : nota, creado_por: c.uid }, "sistema");
      return codigo;
    }

    case "cancelar_codigo_alta": {
      exigirAdminMutador(c);
      const id = coaccionar(ESQUEMA.codigos_alta.cols.id, a.p_id);
      const x = t(c, "codigos_alta").find((k) => k.id === id && k.usado_en == null && k.cancelado_en == null);
      if (x) actualizarFila(c, "codigos_alta", x, { cancelado_en: ahoraISO(c) }, "sistema");
      return null;
    }

    case "establecer_suscripcion": {
      exigirAdminMutador(c);
      const id = coaccionar(ESQUEMA.empresas.cols.id, a.p_empresa);
      const hasta = coaccionar(ESQUEMA.empresas.cols.activa_hasta, a.p_activa_hasta);
      const e = t(c, "empresas").find((k) => k.id === id);
      if (e) actualizarFila(c, "empresas", e, { activa_hasta: hasta, bloqueada: a.p_bloqueada ?? false }, "sistema");
      return null;
    }

    case "borrar_errores_admin": {
      exigirAdminMutador(c);
      c.almacen.tablas.errores_app = [];
      return null;
    }

    default:
      throw new ErrorBD(`Could not find the function public.${nombre} in the schema cache`, "PGRST202");
  }
}

/** Llama a una RPC como lo haría un cliente (anon / authenticated). Lanza ErrorBD. */
export function llamarRpc(c: Ctx, nombre: string, args: Args | undefined): unknown {
  if (SOLO_SERVICIO.has(nombre)) {
    throw new ErrorBD(`permission denied for function ${nombre}`, "42501");
  }
  return transaccion(c, () => llamar(c, nombre, args ?? {}));
}

/** Las RPC que solo puede llamar service_role (webhook de Stripe). */
export function llamarRpcComoServicio(c: Ctx, nombre: string, a: Args): unknown {
  return transaccion(c, () => {
    if (nombre === "registrar_pago_alta") {
      const sesion = String(a.p_session);
      const previo = t(c, "codigos_alta").find((x) => x.stripe_session_id === sesion);
      if (previo) return previo.codigo;
      const codigo = generarCodigoAltaLibre(c);
      insertarFila(
        c,
        "codigos_alta",
        {
          codigo,
          nota: "Pago con tarjeta",
          email: a.p_email ?? null,
          stripe_session_id: sesion,
          stripe_customer_id: a.p_customer ?? null,
          stripe_subscription_id: a.p_subscription ?? null,
          pagado_hasta: a.p_pagado_hasta ?? null,
        },
        "sistema",
      );
      return codigo;
    }
    if (nombre === "actualizar_pago_suscripcion") {
      const sub = a.p_subscription;
      const hasta = coaccionar(ESQUEMA.codigos_alta.cols.pagado_hasta, a.p_pagado_hasta);
      for (const x of t(c, "codigos_alta").filter((k) => k.stripe_subscription_id === sub)) {
        actualizarFila(c, "codigos_alta", x, { pagado_hasta: hasta }, "sistema");
        const e = t(c, "empresas").find((k) => k.id === x.empresa_id);
        if (e && e.activa_hasta != null) actualizarFila(c, "empresas", e, { activa_hasta: hasta }, "sistema");
      }
      return null;
    }
    if (nombre === "generar_codigo_alta_libre") return generarCodigoAltaLibre(c);
    throw new ErrorBD(`Could not find the function public.${nombre} in the schema cache`, "PGRST202");
  });
}

/** Lo que devuelve `db.rpc(...)`: se puede esperar directamente o encadenar single()/maybeSingle(). */
export class ConstructorRpc implements PromiseLike<Resultado> {
  entorno: Entorno;
  nombre: string;
  args: Args | undefined;
  modo: "single" | "maybe" | null = null;
  promesa: Promise<Resultado> | null = null;

  constructor(entorno: Entorno, nombre: string, args: Args | undefined) {
    this.entorno = entorno;
    this.nombre = nombre;
    this.args = args;
  }

  single(): this {
    this.modo = "single";
    return this;
  }

  maybeSingle(): this {
    this.modo = "maybe";
    return this;
  }

  then<A = Resultado, B = never>(
    alCumplir?: ((valor: Resultado) => A | PromiseLike<A>) | null,
    alRechazar?: ((motivo: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    if (!this.promesa) {
      this.promesa = this.entorno.correr<Resultado>(
        (c) => this.ejecutar(c),
        resultadoDeFallo,
        !RPC_SOLO_LECTURA.has(this.nombre),
      );
    }
    return this.promesa.then(alCumplir, alRechazar);
  }

  ejecutar(c: Ctx): Resultado {
    try {
      let data = llamarRpc(c, this.nombre, this.args);
      if (this.modo !== null) {
        const lista = Array.isArray(data) ? data : data === null ? [] : [data];
        if (lista.length === 1) data = lista[0];
        else if (this.modo === "maybe" && lista.length === 0) data = null;
        else {
          const error = {
            message: "JSON object requested, multiple (or no) rows returned",
            code: "PGRST116",
            details: `The result contains ${lista.length} rows`,
            hint: null,
          };
          return { data: null, error, count: null, status: 406, statusText: "Not Acceptable" };
        }
      }
      return { data, error: null, count: null, status: data === null ? 204 : 200, statusText: "" };
    } catch (e) {
      const error = aPlano(e);
      return { data: null, error, count: null, status: estadoDeError(error), statusText: "" };
    }
  }
}
