import clsx from "clsx";

/**
 * Propuesta de marca (pregunta Q-05: decide la dueña). Tres varillas que
 * suben —ferralla, plantas, avance— dentro de una tesela casi negra; la
 * última, en lima, es «lo que se está haciendo hoy». El nombre de trabajo
 * «Control de Obra» no cambia (Q-04).
 */
export function Marca({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="9" fill="#141613" />
      <rect x="10" y="20" width="4" height="11" rx="1" fill="#ffffff" />
      <rect x="18" y="14" width="4" height="17" rx="1" fill="#ffffff" />
      <rect x="26" y="8" width="4" height="23" rx="1" fill="#d5e09c" />
    </svg>
  );
}

export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <Marca size={compacto ? 32 : 36} />
      {!compacto && (
        <span className="text-[1.0625rem] font-semibold leading-none tracking-[-0.02em] text-tinta">
          Control de Obra
        </span>
      )}
    </span>
  );
}
