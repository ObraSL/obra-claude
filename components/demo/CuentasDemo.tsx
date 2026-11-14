"use client";

import { tr } from "@/lib/i18n";
import { CLAVE_DEMO, CUENTAS_DEMO } from "@/lib/datos/memoria";
import { reiniciarDemo } from "@/lib/datos/demo";

/**
 * SOLO MODO DEMO (NEXT_PUBLIC_DATOS=memoria): cuentas ficticias (*.invalid)
 * para probar cada rol con un toque. Este archivo se carga con import
 * dinámico únicamente en ese modo; en producción no existe en el navegador.
 */
export default function CuentasDemo({ onElegir }: { onElegir: (email: string, clave: string) => void }) {
  return (
    <section className="mt-6 rounded-panel bg-sup-honda p-4 text-sobre-honda" aria-label={tr("Cuentas de prueba")}>
      <h2 className="text-base font-medium">{tr("Cuentas de prueba")}</h2>
      <p className="mt-1 text-peq text-sobre-honda-2">
        {tr("Modo demo: datos inventados, sin base de datos. Toca una cuenta y pulsa «Entrar».")}
      </p>
      <ul className="mt-3 grid gap-1.5">
        {CUENTAS_DEMO.map((c) => (
          <li key={c.email}>
            <button
              type="button"
              onClick={() => onElegir(c.email, CLAVE_DEMO)}
              className="flex min-h-11 w-full min-w-0 flex-col items-start rounded-boton bg-white/10 px-3 py-2 text-left hover:bg-white/20"
            >
              <span className="text-peq font-medium">{c.etiqueta}</span>
              <span className="max-w-full break-all text-micro text-sobre-honda-2">{c.email}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={reiniciarDemo}
        className="mt-3 min-h-11 w-full rounded-boton text-peq font-medium underline underline-offset-4"
      >
        {tr("Reiniciar los datos de la demo")}
      </button>
    </section>
  );
}
