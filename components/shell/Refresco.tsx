"use client";

import { useEffect, useRef, useState } from "react";
import { Cargando } from "@/components/ui/Cargando";

/**
 * Tirar hacia abajo para recargar (SHL-07), sin recargar la página entera.
 * Solo actúa arriba del todo; el gesto lanza el evento de ventana
 * `obra:refrescar` y cada pantalla recarga con el mismo cargador que usa al
 * entrar (useEnRefresco). En v2 lo escuchan TODAS las pantallas (en v1 Inicio,
 * Vehículos, Notas, Planificación y Resumen no lo hacían: DIS-15).
 */
export const EVENTO_REFRESCO = "obra:refrescar";
const UMBRAL = 70;

export function useEnRefresco(callback: () => void | Promise<void>) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    const manejador = () => void ref.current();
    window.addEventListener(EVENTO_REFRESCO, manejador);
    return () => window.removeEventListener(EVENTO_REFRESCO, manejador);
  }, []);
}

export function Refresco({ children }: { children: React.ReactNode }) {
  const [altura, setAltura] = useState(0);
  const [girando, setGirando] = useState(false);
  const estado = useRef({ inicioY: 0, arrastrando: false, distancia: 0 });

  useEffect(() => {
    const inicio = (e: TouchEvent) => {
      if (window.scrollY > 0 || girando || document.body.style.overflow === "hidden") return;
      estado.current = { inicioY: e.touches[0].clientY, arrastrando: true, distancia: 0 };
    };
    const mover = (e: TouchEvent) => {
      if (!estado.current.arrastrando) return;
      const delta = e.touches[0].clientY - estado.current.inicioY;
      if (delta <= 0 || window.scrollY > 0) {
        estado.current.arrastrando = false;
        setAltura(0);
        return;
      }
      const distancia = Math.min(delta * 0.5, 90);
      estado.current.distancia = distancia;
      setAltura(distancia);
    };
    const fin = () => {
      if (!estado.current.arrastrando) return;
      estado.current.arrastrando = false;
      if (estado.current.distancia > UMBRAL) {
        setGirando(true);
        setAltura(44);
        window.dispatchEvent(new Event(EVENTO_REFRESCO));
        setTimeout(() => {
          setGirando(false);
          setAltura(0);
        }, 700);
      } else {
        setAltura(0);
      }
    };
    window.addEventListener("touchstart", inicio, { passive: true });
    window.addEventListener("touchmove", mover, { passive: true });
    window.addEventListener("touchend", fin);
    return () => {
      window.removeEventListener("touchstart", inicio);
      window.removeEventListener("touchmove", mover);
      window.removeEventListener("touchend", fin);
    };
  }, [girando]);

  return (
    <>
      <div
        aria-hidden={!girando}
        className="flex items-end justify-center overflow-hidden pb-2 transition-[height] duration-150 ease-out"
        style={{ height: altura }}
      >
        {(girando || altura > 12) && (
          <span style={{ opacity: girando ? 1 : Math.min(1, altura / UMBRAL) }}>
            <Cargando tamano="normal" />
          </span>
        )}
      </div>
      {children}
    </>
  );
}
