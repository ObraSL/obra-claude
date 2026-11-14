"use client";

import { useMiembro } from "@/lib/miembro-context";
import { InicioGestor } from "@/components/pantallas/inicio/InicioGestor";
import { InicioTrabajador } from "@/components/pantallas/inicio/InicioTrabajador";

/** Inicio: variante de gestor (dueño, manager, jefe de obra) o de trabajador (§6). */
export default function InicioPage() {
  const { esTrabajador } = useMiembro();
  return esTrabajador ? <InicioTrabajador /> : <InicioGestor />;
}
