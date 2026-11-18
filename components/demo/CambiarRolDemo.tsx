"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import { useMiembro } from "@/lib/miembro-context";
import { CLAVE_DEMO, EMAIL_DIRECTOR_DEMO, EMAIL_TRABAJADOR_DEMO } from "@/lib/datos/memoria";

/**
 * SOLO MODO DEMO con «?demo=1» (el mismo interruptor que las cuentas de prueba):
 * un botón flotante para pasar del director al trabajador (y al revés) sin salir
 * a la pantalla de entrada. Se carga con import dinámico únicamente en modo demo.
 */
const VER_CUENTAS_DEMO = "obra-demo:ver-cuentas";

export default function CambiarRolDemo() {
  const db = useDb();
  const { esTrabajador } = useMiembro();
  const [visible, setVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(VER_CUENTAS_DEMO) === "1");
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const etiqueta = esTrabajador ? tr("Ver como director") : tr("Ver como trabajador");
  const cambiar = async () => {
    setOcupado(true);
    await db.auth.signOut();
    await db.auth.signInWithPassword({ email: esTrabajador ? EMAIL_DIRECTOR_DEMO : EMAIL_TRABAJADOR_DEMO, password: CLAVE_DEMO });
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={ocupado}
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-full bg-negro px-4 text-peq font-medium text-sobre-negro shadow-lg ring-1 ring-white/25 active:scale-95 disabled:opacity-60 md:bottom-6 md:right-6"
    >
      <ArrowLeftRight size={16} aria-hidden className="text-lima" />
      {etiqueta}
    </button>
  );
}
