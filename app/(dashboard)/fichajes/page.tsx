"use client";

import { useMiembro } from "@/lib/miembro-context";
import { MisHoras } from "@/components/pantallas/fichajes/MisHoras";
import { Cuadrilla } from "@/components/pantallas/fichajes/Cuadrilla";

/** /fichajes: el trabajador se ficha a sí mismo; los gestores fichan a la cuadrilla (§7). */
export default function FichajesPage() {
  const { esTrabajador } = useMiembro();
  return esTrabajador ? <MisHoras /> : <Cuadrilla />;
}
