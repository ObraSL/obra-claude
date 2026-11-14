"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  guardarMiNombre,
  guardarModulo as guardarModuloDb,
  leerAjustes,
  leerEstadoSuscripcion,
  leerMiMiembro,
  soyAdminPlataforma,
  usuarioActual,
} from "@/lib/datos/consultas";
import type { Miembro, Rol } from "@/lib/types";
import { MODULOS_POR_DEFECTO, modulosDesdeFila, type ClaveModulo, type Modulos } from "@/lib/modulos";

/**
 * Quién usa la app y qué puede hacer.
 *
 * La seguridad de verdad está en la base de datos (RLS y triggers): aunque
 * alguien trucara la app, no podría leer ni escribir lo que no le toca. Esto
 * solo sirve para no enseñar botones que luego no van a funcionar (N6).
 */
type MiembroContextValue = {
  miembro: Miembro | null;
  /** Id y correo de la cuenta con sesión (para escrituras que piden owner_id). */
  userId: string | null;
  email: string | null;
  loading: boolean;
  /** No se pudo leer la cuenta (sin conexión o fallo del servidor): no es «pendiente». */
  error: string | null;
  rol: Rol | null;
  esDueno: boolean;
  esTrabajador: boolean;
  /** Dueño, manager o jefe de obra. */
  gestiona: boolean;
  /** Dueño o manager: crean obras, trabajadores y vehículos (la base no deja al jefe de obra). */
  administra: boolean;
  /** Ve la lista de TODAS las empresas; no pertenece a ninguna. */
  esAdminPlataforma: boolean;
  /** Empresa con la prueba/suscripción caducada o bloqueada por el admin. */
  suscripcionInactiva: boolean;
  modulos: Modulos;
  guardarModulo: (clave: ClaveModulo, valor: boolean) => Promise<string | null>;
  refrescar: () => Promise<void>;
  guardarNombre: (nombre: string) => Promise<string | null>;
};

const MiembroContext = createContext<MiembroContextValue | null>(null);

export function MiembroProvider({ children }: { children: React.ReactNode }) {
  const db = useDb();
  const [miembro, setMiembro] = useState<Miembro | null>(null);
  const [usuario, setUsuario] = useState<{ id: string; email: string | null } | null>(null);
  const [esAdminPlataforma, setEsAdminPlataforma] = useState(false);
  const [suscripcionInactiva, setSuscripcionInactiva] = useState(false);
  const [modulos, setModulos] = useState<Modulos>(MODULOS_POR_DEFECTO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data: auth, error: errAuth } = await usuarioActual(db);
    const user = auth?.user ?? null;
    if (!user) {
      setMiembro(null);
      setUsuario(null);
      setEsAdminPlataforma(false);
      // Sin usuario Y con error: no se pudo comprobar (p. ej. sin cobertura).
      setError(errAuth && !/session/i.test(errAuth.message) ? errAuth.message : null);
      setLoading(false);
      return;
    }
    setUsuario({ id: user.id, email: user.email ?? null });

    // Hay que filtrar por user_id sí o sí (T-25): el dueño puede leer las
    // filas de todos, así que sin filtro vendrían varias y maybeSingle()
    // fallaría, dejando al dueño fuera de su propia app.
    const [fila, admin] = await Promise.all([leerMiMiembro(db, user.id), soyAdminPlataforma(db)]);
    if (fila.error) {
      setError(fila.error.message);
      setLoading(false);
      return;
    }
    setError(null);
    setMiembro(fila.data ?? null);

    // La política «empresas propia» solo enseña la empresa de uno; se lee
    // aparte de mi_empresa_id() a propósito (T-27): esa función deja de
    // devolver nada justo cuando la suscripción está caducada.
    const { data: empresa } = await leerEstadoSuscripcion(db);
    setSuscripcionInactiva(
      Boolean(
        empresa &&
          (empresa.bloqueada || (empresa.activa_hasta && new Date(empresa.activa_hasta).getTime() <= Date.now()))
      )
    );
    setEsAdminPlataforma(Boolean(admin.data));

    const { data: ajustes } = await leerAjustes(db);
    setModulos(modulosDesdeFila(ajustes));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarModulo = useCallback(
    async (clave: ClaveModulo, valor: boolean) => {
      if (!usuario) return null;
      const antes = modulos[clave];
      setModulos((m) => ({ ...m, [clave]: valor }));
      const { error: err } = await guardarModuloDb(db, usuario.id, clave, valor);
      if (err) {
        // v1 ignoraba el fallo y el interruptor quedaba cambiado solo en pantalla.
        setModulos((m) => ({ ...m, [clave]: antes }));
        return err.message;
      }
      return null;
    },
    [db, usuario, modulos]
  );

  const guardarNombre = useCallback(
    async (nombre: string) => {
      const { error: err } = await guardarMiNombre(db, nombre);
      if (err) return tr("No se pudo guardar el nombre. Inténtalo otra vez.");
      await cargar();
      return null;
    },
    [db, cargar]
  );

  const rol = miembro?.aprobado ? miembro.rol : null;

  const value: MiembroContextValue = {
    miembro,
    userId: usuario?.id ?? null,
    email: miembro?.email ?? usuario?.email ?? null,
    loading,
    error,
    rol,
    esDueno: rol === "dueno",
    esTrabajador: rol === "trabajador",
    gestiona: rol === "dueno" || rol === "manager" || rol === "jefe_obra",
    administra: rol === "dueno" || rol === "manager",
    esAdminPlataforma,
    suscripcionInactiva,
    modulos,
    guardarModulo,
    refrescar: cargar,
    guardarNombre,
  };

  return <MiembroContext.Provider value={value}>{children}</MiembroContext.Provider>;
}

export function useMiembro() {
  const ctx = useContext(MiembroContext);
  if (!ctx) throw new Error("useMiembro debe usarse dentro de <MiembroProvider>");
  return ctx;
}
