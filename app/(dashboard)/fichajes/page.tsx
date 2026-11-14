"use client";

import { useMiembro } from "@/lib/miembro-context";
import { MisHoras } from "@/components/pantallas/fichajes/MisHoras";

/** /fichajes: el trabajador se ficha a sí mismo; los gestores fichan a la cuadrilla (§7). */
export default function FichajesPage() {
  const { esTrabajador } = useMiembro();
  if (esTrabajador) return <MisHoras />;
  return <p data-testid="cuadrilla-pendiente">Cuadrilla</p>;
}
