import clsx from "clsx";

/**
 * EL MEDIDOR — el semicírculo con aguja de la referencia, pero con datos de la obra:
 * el arco lima es el AVANCE (0–100 %) y la aguja marca el TIEMPO transcurrido del
 * plan (0–100 %, el mismo «hoy» que la línea del Gantt). Si la aguja va por delante
 * del arco, la obra va más lenta que el calendario; si el arco la alcanza, va al día.
 *
 * Es un gráfico de dos números, así que lleva su texto accesible (`titulo`) y el
 * texto visible va justo debajo, en la tarjeta. Solo anima transform/stroke; con
 * «reducir movimiento» se pinta ya terminado (reglas en globals.css).
 */
const CENTRO = { x: 60, y: 62 };
const ARCO = "M 12 62 A 48 48 0 0 1 108 62";

const acotar = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);

export function Medidor({
  avance,
  tiempo,
  titulo,
  className,
}: {
  /** 0–100: lo hecho (arco). */
  avance: number;
  /** 0–100: lo que ha pasado del calendario (aguja). */
  tiempo: number;
  titulo: string;
  className?: string;
}) {
  const a = acotar(avance);
  const t = acotar(tiempo);
  const angulo = -90 + (t / 100) * 180; // 0 % = aguja a la izquierda, 100 % = a la derecha

  return (
    <svg viewBox="0 0 120 70" role="img" aria-label={titulo} className={clsx("block w-full", className)}>
      {/* carril */}
      <path d={ARCO} pathLength={100} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={9} strokeLinecap="round" />
      {/* avance (con 0 % no se pinta: un trazo redondo de largo cero saldría como un punto) */}
      {a > 0.5 && (
        <path
          className="medidor-arco"
          d={ARCO}
          pathLength={100}
          fill="none"
          stroke="var(--c-lima)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${a} 100`}
          style={{ ["--fin" as string]: a }}
        />
      )}
      {/* aguja del tiempo */}
      <g
        className="medidor-aguja"
        style={{ transform: `rotate(${angulo}deg)`, transformOrigin: `${CENTRO.x}px ${CENTRO.y}px`, ["--ang" as string]: `${angulo}deg` }}
      >
        <line x1={CENTRO.x} y1={CENTRO.y} x2={CENTRO.x} y2={26} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={CENTRO.x} cy={CENTRO.y} r={6.5} fill="currentColor" />
      <circle cx={CENTRO.x} cy={CENTRO.y} r={2.6} fill="var(--c-sup-honda)" />
    </svg>
  );
}
