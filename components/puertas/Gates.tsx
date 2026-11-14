"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { useMiembro } from "@/lib/miembro-context";
import { AVISO_CONTROL_VERSION } from "@/lib/types";
import { RUTAS_SOLO_GESTORES } from "@/lib/nav";
import { rutaApagada } from "@/lib/modulos";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Landing } from "@/components/landing/Landing";
import { AvisoControl, PendienteAprobacion, SinConexionCuenta, SuscripcionInactiva } from "./Puertas";

/**
 * Cadena de puertas del panel (ACC-08), en este orden exacto:
 * sin sesión → landing · admin de plataforma → /admin · ruta prohibida
 * (trabajador en ruta de gestor, o módulo apagado) → «/» · sin aprobar →
 * pendiente · suscripción inactiva → pausa · trabajador sin leer el aviso
 * vigente → aviso · la app.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <CargandoBloque />;
  // Sin sesión: la pantalla pública. No se monta nada del panel, así no se
  // gasta ni una petición hasta saber que hay usuario.
  if (!session) return <Landing />;
  return <>{children}</>;
}

export function AccesoGate({ children }: { children: React.ReactNode }) {
  const { miembro, loading, error, refrescar, esTrabajador, esAdminPlataforma, suscripcionInactiva, modulos } = useMiembro();
  const necesitaLeerAviso =
    esTrabajador && miembro?.aprobado && miembro.aviso_control_version !== AVISO_CONTROL_VERSION;
  const pathname = usePathname();
  const router = useRouter();

  const rutaProhibida =
    (esTrabajador && RUTAS_SOLO_GESTORES.some((r) => pathname.startsWith(r))) ||
    (!loading && rutaApagada(pathname, modulos));

  useEffect(() => {
    if (rutaProhibida) router.replace("/");
  }, [rutaProhibida, router]);

  // Un administrador de la plataforma no pertenece a ninguna empresa: no
  // tiene sentido que espere aquí a que un dueño lo apruebe.
  useEffect(() => {
    if (!loading && esAdminPlataforma) router.replace("/admin");
  }, [loading, esAdminPlataforma, router]);

  if (loading || rutaProhibida || esAdminPlataforma) return <CargandoBloque />;

  // No se pudo leer la cuenta: decir la verdad en vez de «pendiente» (DIS-13).
  if (error && !miembro) return <SinConexionCuenta detalle={error} onReintentar={refrescar} />;
  if (!miembro?.aprobado) return <PendienteAprobacion />;
  if (suscripcionInactiva) return <SuscripcionInactiva />;
  if (necesitaLeerAviso) return <AvisoControl />;

  return <>{children}</>;
}
