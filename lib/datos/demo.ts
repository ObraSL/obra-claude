import type { Db } from "./db";
import {
  CLAVE_DEMO,
  crearAlmacen,
  crearClienteMemoria,
  deserializarAlmacen,
  serializarAlmacen,
  type Almacen,
} from "./memoria";

/**
 * Cliente del MODO DEMO (D-09): un solo motor en memoria para toda la app,
 * guardado en localStorage para que una recarga no pierda lo hecho (fichajes,
 * gastos, la sesión). Solo se carga con NEXT_PUBLIC_DATOS=memoria, por
 * import dinámico: en producción este archivo no viaja al navegador.
 *
 * Todo lo que hay aquí son datos inventados (correos *.invalid).
 */
const CLAVE = "obra-demo:almacen:v1";

let cliente: Db | null = null;
let almacen: Almacen | null = null;
let pendiente: ReturnType<typeof setTimeout> | null = null;

function leerGuardado(): Almacen | null {
  try {
    const texto = window.localStorage.getItem(CLAVE);
    return texto ? deserializarAlmacen(texto) : null;
  } catch {
    return null;
  }
}

function guardar() {
  if (!almacen) return;
  try {
    window.localStorage.setItem(CLAVE, serializarAlmacen(almacen));
  } catch {
    // Almacenamiento lleno (fotos grandes) o modo privado: la demo sigue en memoria.
  }
}

function guardarLuego() {
  if (pendiente) clearTimeout(pendiente);
  pendiente = setTimeout(guardar, 150);
}

export function dbDemo(): Db {
  if (cliente) return cliente;
  almacen = leerGuardado() ?? crearAlmacen("poblado");
  cliente = crearClienteMemoria({ almacen, latenciaMs: 140, alCambiar: guardarLuego });
  // Entrar y salir también cambian el almacén (la sesión) sin pasar por alCambiar.
  cliente.auth.onAuthStateChange(() => guardarLuego());
  window.addEventListener("pagehide", guardar);

  // Ayuda para las pruebas automáticas y la revisión (solo existe en modo
  // demo): cambiar de cuenta ficticia sin pasar por el formulario.
  const db = cliente;
  (window as unknown as { __obraDemo?: unknown }).__obraDemo = {
    entrar: async (email: string) => {
      await db.auth.signOut();
      const r = await db.auth.signInWithPassword({ email, password: CLAVE_DEMO });
      guardar();
      return r.error?.message ?? null;
    },
    salir: async () => {
      await db.auth.signOut();
      guardar();
    },
    reiniciar: reiniciarDemo,
  };
  return cliente;
}

/** Vuelve a los datos de fábrica de la demo y recarga la página. */
export function reiniciarDemo() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
  window.location.href = "/";
}
