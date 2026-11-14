"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import { cerrarSesion } from "@/lib/datos/consultas";
import { Logo } from "@/components/marca/Logo";
import { Boton } from "@/components/ui/Boton";

/** Cerrar sesión como en v1: salir y volver a «/» (ACC-14). */
export function useSalir(destino: "/" | "/login" = "/") {
  const db = useDb();
  const router = useRouter();
  return async () => {
    await cerrarSesion(db);
    router.push(destino);
    router.refresh();
  };
}

/**
 * Marco común de las pantallas-puerta (pendiente de aprobación, suscripción
 * inactiva, aviso de control, sin conexión): marca arriba, un solo h1 con su
 * icono, contenido, y «Cerrar sesión» siempre abajo (ACC-14). 100dvh y zonas
 * seguras (T-04).
 */
export function PantallaPuerta({
  icono,
  titulo,
  children,
  textoSalir,
  sinSalir,
}: {
  icono: ReactNode;
  titulo: ReactNode;
  children: ReactNode;
  /** v1 usa «Salir» en la de suscripción y «Cerrar sesión» en el resto. */
  textoSalir?: string;
  sinSalir?: boolean;
}) {
  const salir = useSalir("/");
  return (
    <main className="flex min-h-[100dvh] flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.75rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Logo className="mb-8" />
        <h1 className="mb-2 flex items-start gap-2.5 text-h1 font-medium tracking-[-0.02em]">
          <span aria-hidden className="mt-1 shrink-0 text-lima-texto">
            {icono}
          </span>
          <span className="min-w-0 text-balance">{titulo}</span>
        </h1>
        {children}
        {!sinSalir && (
          <div className="mt-auto pt-8">
            <Boton variante="secundario" ancho onClick={salir} icono={<LogOut size={18} aria-hidden />}>
              {textoSalir ?? tr("Cerrar sesión")}
            </Boton>
          </div>
        )}
      </div>
    </main>
  );
}
