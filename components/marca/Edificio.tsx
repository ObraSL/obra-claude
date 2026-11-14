"use client";

import { useId, useMemo } from "react";

/**
 * EL EDIFICIO — pieza firma del diseño (ENTREGA/01-diseno/concepto.md).
 *
 * Un esqueleto de hormigón en isométrica que se construye con el avance
 * real de la obra: cada planta es un forjado con su canto de encofrado,
 * pilares y, en la última, las esperas de ferralla asomando. Al 100 % se
 * acristala. Dibujado en código (SVG, < 4 KB en pantalla, sin imágenes de
 * terceros) para que cambie con los datos.
 *
 * Solo transform/opacity en la animación; con prefers-reduced-motion se
 * pinta directamente terminado.
 */
type Props = {
  /** 0–100. Decide cuántas plantas están hechas. */
  avance: number;
  /** Plantas totales del dibujo (no son datos de la obra: es la escala visual). */
  plantas?: number;
  /** Vanos a lo ancho y a lo hondo. */
  vanosX?: number;
  vanosY?: number;
  /** Mostrar la grúa. */
  grua?: boolean;
  /** Animar la subida de plantas al montar. */
  animar?: boolean;
  className?: string;
  /** Texto accesible (el dibujo es decorativo si no se da). */
  titulo?: string;
};

const U = 26; // ancho de un vano (unidades del viewBox)
const H = 22; // altura de planta
const T = 4.5; // canto del forjado
const C = Math.cos(Math.PI / 6) * U;
const S = Math.sin(Math.PI / 6) * U;

type P = [number, number];
const iso = (x: number, y: number, z: number): P => [(x - y) * C, (x + y) * S - z];
const pts = (...ps: P[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

// Colores del dibujo: hormigón y encofrado. No son tokens de interfaz (no
// llevan texto encima) y no cambian con el tema: el edificio es el mismo.
const COL = {
  losaTop: "#d9dcd4",
  losaIzq: "#e3d36a",
  losaDer: "#c9b955",
  pilarIzq: "#c3c7bd",
  pilarDer: "#9ea395",
  hierro: "#3a3f37",
  vidrio: "#3d4a3c",
  luz: "#f3d98f",
  grua: "#e3d36a",
  gruaSombra: "#b9a94a",
  sombra: "rgb(20 22 19 / 0.22)",
};

export function Edificio({
  avance,
  plantas = 7,
  vanosX = 4,
  vanosY = 3,
  grua = true,
  animar = true,
  className,
  titulo,
}: Props) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, Number.isFinite(avance) ? avance : 0));
  const hechas = Math.floor((pct / 100) * plantas + 1e-9);
  const resto = (pct / 100) * plantas - hechas;
  const acabado = pct >= 100;
  const A = vanosX;
  const B = vanosY;

  const dibujo = useMemo(() => {
    const capas: React.ReactNode[] = [];
    let n = 0;

    // Sombra en el suelo
    const m = 0.9;
    capas.push(
      <polygon
        key="sombra"
        points={pts(iso(-m, -m, 0), iso(A + m + 1.2, -m, 0), iso(A + m + 1.2, B + m, 0), iso(-m, B + m, 0))}
        fill={COL.sombra}
      />
    );

    // Cimentación: siempre hay al menos la losa de planta baja
    const losa = (z: number, k: number, retraso: number) => (
      <g
        key={`losa-${k}`}
        className={animar ? "edificio-planta" : undefined}
        style={animar ? { animationDelay: `${retraso}ms` } : undefined}
      >
        <polygon points={pts(iso(0, B, z + T), iso(A, B, z + T), iso(A, B, z), iso(0, B, z))} fill={COL.losaIzq} />
        <polygon points={pts(iso(A, 0, z + T), iso(A, B, z + T), iso(A, B, z), iso(A, 0, z))} fill={COL.losaDer} />
        <polygon points={pts(iso(0, 0, z + T), iso(A, 0, z + T), iso(A, B, z + T), iso(0, B, z + T))} fill={COL.losaTop} />
      </g>
    );

    const pilares = (z0: number, z1: number, k: number, retraso: number, parcial = false) => {
      const lista: React.ReactNode[] = [];
      const puntos: [number, number][] = [];
      for (let i = 0; i <= A; i++) for (let j = 0; j <= B; j++) puntos.push([i, j]);
      puntos.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
      for (const [i, j] of puntos) {
        // En la planta parcial solo se levantan los pilares de delante
        if (parcial && i + j < (A + B) / 2) continue;
        const [x0, y0] = iso(i, j, z0);
        const [, y1] = iso(i, j, z1);
        lista.push(
          <g key={`p-${k}-${i}-${j}`}>
            <rect x={x0 - 2.6} y={y1} width={2.6} height={y0 - y1} fill={COL.pilarIzq} />
            <rect x={x0} y={y1} width={2.6} height={y0 - y1} fill={COL.pilarDer} />
          </g>
        );
      }
      return (
        <g
          key={`pilares-${k}`}
          className={animar ? "edificio-planta" : undefined}
          style={animar ? { animationDelay: `${retraso}ms` } : undefined}
        >
          {lista}
        </g>
      );
    };

    const vidrios = (z0: number, z1: number, k: number) => {
      const lista: React.ReactNode[] = [];
      // Cara izquierda (y = B) y derecha (x = A), un paño por vano
      for (let i = 0; i < A; i++) {
        const luz = (i * 7 + k * 3) % 5 === 0;
        lista.push(
          <polygon
            key={`vi-${k}-${i}`}
            points={pts(iso(i + 0.08, B, z0 + T), iso(i + 0.92, B, z0 + T), iso(i + 0.92, B, z1), iso(i + 0.08, B, z1))}
            fill={luz ? COL.luz : COL.vidrio}
            opacity={luz ? 0.95 : 0.85}
          />
        );
      }
      for (let j = 0; j < B; j++) {
        const luz = (j * 5 + k * 2) % 4 === 1;
        lista.push(
          <polygon
            key={`vd-${k}-${j}`}
            points={pts(iso(A, j + 0.08, z0 + T), iso(A, j + 0.92, z0 + T), iso(A, j + 0.92, z1), iso(A, j + 0.08, z1))}
            fill={luz ? COL.luz : COL.vidrio}
            opacity={luz ? 0.9 : 0.75}
          />
        );
      }
      return <g key={`vidrios-${k}`}>{lista}</g>;
    };

    const paso = 140;
    capas.push(losa(0, n++, 0));
    for (let k = 0; k < hechas; k++) {
      const z0 = k * H;
      const z1 = (k + 1) * H;
      capas.push(pilares(z0 + T, z1, k, (k + 0.5) * paso));
      if (acabado) capas.push(vidrios(z0, z1, k));
      capas.push(losa(z1, k + 1, (k + 1) * paso));
    }
    // Planta en marcha: pilares delanteros y esperas de ferralla
    const zTop = hechas * H;
    if (!acabado && resto > 0.15) capas.push(pilares(zTop + T, zTop + H * Math.max(0.45, resto), hechas, (hechas + 0.5) * paso, true));
    if (!acabado) {
      const esperas: React.ReactNode[] = [];
      for (let i = 0; i <= A; i++) {
        for (let j = 0; j <= B; j++) {
          if (i + j < (A + B) / 2 && resto > 0.15) continue;
          const [x, y] = iso(i, j, zTop + T);
          esperas.push(<line key={`e-${i}-${j}`} x1={x} y1={y} x2={x} y2={y - 7} stroke={COL.hierro} strokeWidth={0.9} />);
        }
      }
      capas.push(
        <g key="esperas" className={animar ? "edificio-planta" : undefined} style={animar ? { animationDelay: `${(hechas + 1) * paso}ms` } : undefined}>
          {esperas}
        </g>
      );
    }

    // Grúa torre: mástil de celosía al lado, pluma por encima del edificio
    if (grua && !acabado) {
      const gx = A + 1.1;
      const gy = B * 0.35;
      const alto = (plantas + 2.2) * H;
      const [mx, my] = iso(gx, gy, 0);
      const [, mt] = iso(gx, gy, alto);
      const ancho = 6;
      const celosia: string[] = [];
      for (let y = my; y > mt + 6; y -= 9) celosia.push(`M${mx - ancho / 2},${y} L${mx + ancho / 2},${y - 9}`);
      const [px, py] = iso(gx - (A + 1.6), gy, alto);
      const [cx, cy] = iso(gx + 1.6, gy, alto);
      const ganchoX = (A * 0.45);
      const [hx, hy] = iso(gx - (A + 1.1) + ganchoX, gy, alto);
      const [, hb] = iso(gx - (A + 1.1) + ganchoX, gy, zTop + H * 1.4);
      capas.push(
        <g key="grua" className={animar ? "edificio-grua" : undefined}>
          <rect x={mx - ancho / 2} y={mt} width={ancho} height={my - mt} fill="none" stroke={COL.grua} strokeWidth={1.2} />
          <path d={celosia.join(" ")} stroke={COL.grua} strokeWidth={0.9} fill="none" />
          <line x1={px} y1={py} x2={cx} y2={cy} stroke={COL.grua} strokeWidth={2.4} strokeLinecap="round" />
          <line x1={mx} y1={mt - 12} x2={px + (mx - px) * 0.35} y2={py + (my - my)} stroke={COL.gruaSombra} strokeWidth={0.8} />
          <line x1={mx} y1={mt - 12} x2={cx} y2={cy} stroke={COL.gruaSombra} strokeWidth={0.8} />
          <line x1={mx} y1={mt} x2={mx} y2={mt - 12} stroke={COL.grua} strokeWidth={1.6} />
          <rect x={cx - 5} y={cy - 2} width={9} height={7} fill={COL.gruaSombra} />
          <line x1={hx} y1={hy} x2={hx} y2={hb} stroke={COL.hierro} strokeWidth={0.7} />
          <rect x={hx - 2.5} y={hb} width={5} height={5} fill={COL.hierro} />
        </g>
      );
    }
    return capas;
  }, [A, B, hechas, resto, acabado, grua, plantas, animar]);

  // Caja del dibujo calculada a partir de las esquinas extremas
  const alto = (plantas + (grua && !acabado ? 2.6 : 0.6)) * H;
  const minX = iso(0, B + 1, 0)[0] - 6;
  const maxX = iso(A + 2.8, 0, 0)[0] + 6;
  const minY = iso(0, 0, alto)[1] - 6;
  const maxY = iso(A + 1.5, B + 1, 0)[1] + 4;

  return (
    <svg
      viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`}
      className={className}
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-labelledby={titulo ? `${id}-t` : undefined}
      preserveAspectRatio="xMidYMax meet"
    >
      {titulo && <title id={`${id}-t`}>{titulo}</title>}
      {dibujo}
    </svg>
  );
}
