"use client";

import { useState } from "react";
import { Edificio } from "@/components/marca/Edificio";
import { Varillas, type Varilla } from "@/components/marca/Varillas";
import { Logo } from "@/components/marca/Logo";
import { useTema } from "@/lib/tema-provider";

/** Hoja de identidad viva: colores, letra, edificio y varillas con datos de prueba. */
export default function GaleriaIdentidad() {
  const [avance, setAvance] = useState(64);
  const { tema, cambiarTema } = useTema();

  const plan: Varilla[] = Array.from({ length: 44 }, (_, i) => {
    const carga = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11));
    const hoy = 27;
    return { alto: carga, tono: i < 10 ? "lima" : i < 13 ? "coral" : i < hoy ? "lima" : "blanco" };
  });
  const presupuesto: Varilla[] = Array.from({ length: 48 }, (_, i) => ({
    alto: 1,
    tono: i < 30 ? "blanco" : i < 42 ? "lima" : "coral",
  }));

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <Logo />
        <button
          type="button"
          onClick={() => cambiarTema(tema === "salvia" ? "claro" : "salvia")}
          className="h-11 rounded-boton bg-negro px-4 text-peq font-medium text-sobre-negro"
        >
          {tema === "salvia" ? "Tema claro" : "Tema salvia"}
        </button>
      </div>

      <h1 className="text-h1 font-medium tracking-[-0.02em]">Obras activas</h1>

      <section className="relative mt-4 overflow-hidden rounded-panel">
        <span className="absolute right-3 top-3 z-10 rounded-boton bg-sup-honda px-3 py-1.5 text-peq text-sobre-honda">
          En marcha
        </span>
        <Edificio avance={avance} className="mx-auto block h-64 w-full" titulo={`Avance ${avance} %`} />
      </section>

      <label className="mt-2 block text-peq">
        Avance de prueba: <b className="cifras">{avance} %</b>
        <input
          type="range"
          min={0}
          max={100}
          value={avance}
          onChange={(e) => setAvance(Number(e.target.value))}
          className="mt-2 block w-full accent-[var(--c-lima)]"
        />
      </label>

      <section className="mt-6 rounded-panel bg-sup-honda p-4 text-sobre-honda">
        <h2 className="text-titulo font-medium">Reforma calle Mayor 12</h2>
        <p className="text-peq text-sobre-honda-2">Calle Mayor 12, Valencia</p>
        <p className="mt-4 text-peq">Avance</p>
        <Varillas
          varillas={plan}
          alto={64}
          marca={{ posicion: 27.5 / 44, etiqueta: "60,11 %" }}
          resumen="Avance del plan 60,11 %"
          className="mt-2"
        />
      </section>

      <section className="mt-4 rounded-panel bg-sup-honda p-4 text-sobre-honda">
        <h2 className="text-peq">Presupuesto gastado</h2>
        <Varillas varillas={presupuesto} alto={56} resumen="Gastado 62 % del presupuesto" className="mt-3" grosor={0.5} />
      </section>

      <div className="mt-6 grid gap-3">
        <button type="button" className="h-14 rounded-boton bg-lima text-base font-medium text-sobre-lima">
          Marcar mi entrada
        </button>
        <button type="button" className="h-14 rounded-boton bg-negro text-base font-medium text-sobre-negro">
          Crear cuenta
        </button>
      </div>

      <section className="mt-8 grid gap-1">
        <p className="text-gigante cifras font-light tracking-[-0.04em]">07:58</p>
        <p className="text-cifra cifras font-light tracking-[-0.03em]">+12.450 €</p>
        <p className="text-h1 font-medium">Мої години · листопад</p>
        <p className="text-titulo">Повернутись до сьогодні</p>
        <p className="text-base">Las horas de otros días solo las puede cambiar el dueño.</p>
        <p className="text-peq">Hours are recorded with the server clock.</p>
      </section>
    </main>
  );
}
