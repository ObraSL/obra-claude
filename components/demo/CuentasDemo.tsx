"use client";

import { tr } from "@/lib/i18n";
import { CLAVE_DEMO, CUENTAS_DEMO, EMAIL_DIRECTOR_DEMO, EMAIL_TRABAJADOR_DEMO } from "@/lib/datos/memoria";
import { reiniciarDemo } from "@/lib/datos/demo";

/**
 * SOLO MODO DEMO (NEXT_PUBLIC_DATOS=memoria): cuentas ficticias (*.invalid)
 * para probar cada rol con un toque. Este archivo se carga con import
 * dinámico únicamente en ese modo; en producción no existe en el navegador.
 */
export default function CuentasDemo({
  onElegir,
  onEntrar,
}: {
  onElegir: (email: string, clave: string) => void;
  /** Entra directamente (sin pasar por el formulario). */
  onEntrar: (email: string, clave: string) => void;
}) {
  return (
    <section className="mt-6 rounded-panel bg-sup-honda p-4 text-sobre-honda" aria-label={tr("Cuentas de prueba")}>
      <h2 className="text-base font-medium">{tr("Cuentas de prueba")}</h2>
      <p className="mt-1 text-peq text-sobre-honda-2">
        {tr("Modo demo: datos inventados, sin base de datos. Toca una cuenta y pulsa «Entrar».")}
      </p>
      {/* Los dos accesos para comparar: el dueño con todo y un trabajador. */}
      <div className="mt-3 grid gap-2.5">
        <button
          type="button"
          onClick={() => onEntrar(EMAIL_DIRECTOR_DEMO, CLAVE_DEMO)}
          className="flex min-h-14 w-full min-w-0 flex-col items-start rounded-boton bg-lima px-4 py-2.5 text-left text-sobre-lima active:scale-[0.985]"
        >
          <span className="text-base font-medium">{tr("Entrar como director")}</span>
          <span className="text-peq">{tr("Todo: obras, dinero, ajustes y equipo")}</span>
        </button>
        <button
          type="button"
          onClick={() => onEntrar(EMAIL_TRABAJADOR_DEMO, CLAVE_DEMO)}
          className="flex min-h-14 w-full min-w-0 flex-col items-start rounded-boton bg-negro px-4 py-2.5 text-left text-sobre-negro active:scale-[0.985]"
        >
          <span className="text-base font-medium">{tr("Entrar como trabajador")}</span>
          <span className="text-peq text-white/80">{tr("Solo sus horas, vehículos y ajustes")}</span>
        </button>
      </div>

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-peq font-medium underline underline-offset-4">
          {tr("Otras cuentas de prueba")}
        </summary>
        <ul className="mt-1.5 grid gap-1.5">
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
      </details>
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
