"use client";

import Link from "next/link";
import { tr } from "@/lib/i18n";
import { FotoObra } from "@/components/marca/FotoObra";
import { Varillas, type Varilla } from "@/components/marca/Varillas";
import { Logo } from "@/components/marca/Logo";
import { SelectorIdioma } from "@/components/ui/SelectorIdioma";

/**
 * Pantalla pública (ACC-01): cabe en UNA pantalla sin scroll, de 320×568 a
 * 430×932 (100dvh + zonas seguras; el edificio es el que cede altura).
 * Todo lo que enseña es una vista previa rotulada como tal: nunca datos
 * reales. La forma es la del «Welcome» de la referencia: obra arriba,
 * nombre grande, una frase y dos botones (lima = entrar, negro = crear cuenta).
 */
const AVANCE_DEMO = 72;

const PLAN_DEMO: Varilla[] = Array.from({ length: 36 }, (_, i) => ({
  alto: 0.4 + 0.6 * Math.abs(Math.sin(i * 0.41) * Math.cos(i * 0.13)),
  tono: i < 26 ? "lima" : "blanco",
}));

export function Landing() {
  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Logo compacto />
        <SelectorIdioma />
      </div>

      {/* La obra: ocupa lo que sobre y encoge en móviles bajos */}
      <div className="relative min-h-0 flex-1">
        <FotoObra prioritaria className="-mx-5 h-full" />
      </div>

      <section
        aria-label={tr("Progreso de la obra")}
        className="shrink-0 rounded-panel bg-sup-honda px-4 pb-3 pt-3 text-sobre-honda"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-peq">{tr("Progreso de la obra")}</p>
          <p className="cifras text-titulo font-light">{AVANCE_DEMO} %</p>
        </div>
        <Varillas
          varillas={PLAN_DEMO}
          alto={30}
          marca={{ posicion: 26 / 36 }}
          resumen={`${tr("Progreso de la obra")}: ${AVANCE_DEMO} %`}
          className="mt-2"
        />
        <p className="mt-3 text-micro text-sobre-honda-2">{tr("Vista previa — inicia sesión para ver el progreso real")}</p>
      </section>

      <div className="shrink-0 pt-5">
        <h1 className="text-cifra font-light tracking-[-0.03em]">Control de Obra</h1>
        <p className="mt-2 text-base leading-snug">{tr("Inicia sesión para fichar, apuntar gastos y subir facturas")}</p>
        <div className="mt-5 grid gap-2.5">
          <Link
            href="/login"
            className="flex min-h-[52px] items-center justify-center rounded-boton bg-lima px-5 text-center text-base font-medium text-sobre-lima active:scale-[0.985]"
          >
            {tr("Iniciar sesión")}
          </Link>
          <Link
            href="/login?registro=1"
            className="flex min-h-[52px] items-center justify-center rounded-boton bg-negro px-5 text-center text-base font-medium text-sobre-negro active:scale-[0.985]"
          >
            {tr("Crear cuenta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
