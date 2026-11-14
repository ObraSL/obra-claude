"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

/**
 * «Teléfono en el ordenador»: la app dentro de una ventana del tamaño de un
 * móvil, para revisarla como se verá en el teléfono sin coger el teléfono.
 * Es una herramienta de revisión de la dueña (como la hoja de identidad): vive
 * en /galeria, solo existe con NEXT_PUBLIC_GALERIA=1 y no forma parte del
 * producto. Los textos van en ucraniano a propósito (la galería no usa tr()).
 *
 * El iframe tiene el ancho real del móvil, así que la app aplica su diseño de
 * móvil (no el de ordenador); se encoge con `scale` solo si la pantalla del
 * ordenador es baja. Comparte la sesión de demo con el resto del sitio.
 */
const MODELOS = [
  { id: "se", nombre: "iPhone SE", w: 375, h: 667 },
  { id: "15", nombre: "iPhone 15", w: 393, h: 852 },
  { id: "max", nombre: "iPhone Pro Max", w: 430, h: 932 },
  { id: "android", nombre: "Android", w: 360, h: 800 },
] as const;

const BISEL = 14; // marco negro alrededor de la pantalla
const TOPE = 34; // más marco arriba (altavoz)

// Tamaño de la ventana del ordenador, sin setState dentro de efectos.
const suscribir = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const medidas = () => `${window.innerWidth}x${window.innerHeight}`;

export default function GaleriaMovil() {
  const [modelo, setModelo] = useState<(typeof MODELOS)[number]>(MODELOS[1]);
  const [version, setVersion] = useState(0);
  const ventana = useSyncExternalStore(suscribir, medidas, () => "1280x800");
  const [ancho, alto] = ventana.split("x").map(Number);

  const totalW = modelo.w + BISEL * 2;
  const totalH = modelo.h + BISEL + TOPE;
  const escala = Math.max(0.4, Math.min(1, (alto - 170) / totalH, (ancho - 24) / totalW));

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[#1b1f1a] px-3 pb-8 pt-5 text-white">
      <h1 className="text-center text-titulo font-medium">Телефон на комп&apos;ютері</h1>
      <p className="mt-1 max-w-md text-center text-peq text-white/75">
        Сайт у вікні розміру телефона: так він виглядає на екрані телефона. Вибери модель, а в самому вікні тицяй мишкою як пальцем.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Модель телефона">
        {MODELOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModelo(m)}
            aria-pressed={modelo.id === m.id}
            className={
              "min-h-11 rounded-boton px-4 text-peq font-medium " +
              (modelo.id === m.id ? "bg-lima text-sobre-lima" : "bg-white/10 text-white hover:bg-white/15")
            }
          >
            {m.nombre} <span className="cifras opacity-70">{m.w}×{m.h}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVersion((v) => v + 1)}
          className="min-h-11 rounded-boton bg-white/10 px-4 text-peq font-medium hover:bg-white/15"
        >
          Оновити
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-boton bg-white/10 px-4 text-peq font-medium hover:bg-white/15">
          Відкрити без рамки
        </Link>
      </div>

      {/* Caja con el tamaño ya escalado, para que el scroll de la página no cuente el tamaño sin escalar */}
      <div className="mt-5" style={{ width: totalW * escala, height: totalH * escala }}>
        <div
          style={{
            width: totalW,
            height: totalH,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
            padding: `${TOPE}px ${BISEL}px ${BISEL}px`,
            background: "#0a0b0a",
            borderRadius: 52,
            boxShadow: "0 0 0 2px #2b2f2a, 0 30px 60px -20px rgb(0 0 0 / 0.7)",
            position: "relative",
          }}
        >
          <span aria-hidden style={{ position: "absolute", top: 12, left: "50%", width: 70, height: 8, marginLeft: -35, borderRadius: 4, background: "#23261f" }} />
          <iframe
            key={`${modelo.id}-${version}`}
            src="/"
            title="Control de Obra у вікні телефона"
            style={{ width: modelo.w, height: modelo.h, border: 0, borderRadius: 38, background: "#6b7867", display: "block" }}
          />
        </div>
      </div>
    </main>
  );
}
