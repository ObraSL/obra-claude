"use client";

import { useMiembro } from "@/lib/miembro-context";
import { useObra } from "@/lib/obra-context";

/** Inicio (provisional mientras se construyen las variantes de gestor y trabajador). */
export default function Inicio() {
  const { rol, email } = useMiembro();
  const { obraActual } = useObra();
  return (
    <div data-testid="inicio-provisional">
      <h1 className="text-h1 font-medium">{obraActual?.nombre}</h1>
      <p className="mt-2 text-base">
        {email} · {rol}
      </p>
    </div>
  );
}
