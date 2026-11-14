"use client";

import { ChevronRight, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { tr } from "@/lib/i18n";
import type { Obra } from "@/lib/types";
import { Boton, BotonIcono } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { FormObraNueva } from "@/components/shell/SelectorObra";
import { BotonEstado, SeccionAjustes } from "./SeccionListaActivable";

/**
 * Obras (AJU-07). Dueño y manager ven todas, activas o cerradas; tocar una la
 * hace la actual y lleva al Inicio. Ubicación y horario y Borrar son SOLO del
 * dueño (la base lo permite también al manager, DIS-68: aquí no se enseña).
 */
export function SeccionObras({
  obras,
  esDueno,
  onAbrir,
  onCambiarActiva,
  onCrear,
  onConfigurar,
  onBorrar,
}: {
  obras: Obra[];
  esDueno: boolean;
  onAbrir: (id: string) => void;
  /** Devuelve un mensaje de error, o null si salió bien. */
  onCambiarActiva: (id: string) => Promise<string | null>;
  onCrear: (nombre: string, direccion: string) => Promise<string | null>;
  onConfigurar: (obra: Obra) => void;
  onBorrar: (obra: Obra) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cambiar = async (id: string) => {
    setError("");
    setOcupada(id);
    const fallo = await onCambiarActiva(id);
    setOcupada(null);
    if (fallo) setError(fallo);
  };

  return (
    <SeccionAjustes
      titulo={tr("Obras")}
      descripcion={tr("Toca una obra para verla entera (fichajes, gastos, dinero…), esté activa o cerrada.")}
      testid="ajustes-obras"
    >
      <ul className="grid gap-2">
        {obras.map((o) => (
          <li key={o.id} className="grid min-w-0 gap-1 rounded-[10px] bg-fondo/60 p-2">
            <button
              type="button"
              onClick={() => onAbrir(o.id)}
              className="flex min-h-14 w-full min-w-0 items-center justify-between gap-2 rounded-boton px-1.5 py-1 text-left hover:bg-fondo"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base font-semibold">{o.nombre}</span>
                {o.direccion && (
                  <span className="mt-0.5 flex items-start gap-1 text-peq text-tinta-2">
                    <MapPin size={14} aria-hidden className="mt-0.5 shrink-0" />
                    <span className="min-w-0 break-words">{o.direccion}</span>
                  </span>
                )}
              </span>
              <ChevronRight size={20} aria-hidden className="shrink-0" />
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2 px-1.5 pb-1">
              <BotonEstado
                activo={o.activa}
                textoActivo={tr("Activa")}
                textoInactivo={tr("Cerrada")}
                cargando={ocupada === o.id}
                onClick={() => cambiar(o.id)}
              />
              {esDueno && (
                <>
                  <BotonIcono
                    sobre="panel"
                    aria-label={tr("Ubicación y horario de {obra}", { obra: o.nombre })}
                    onClick={() => onConfigurar(o)}
                  >
                    <MapPin size={20} aria-hidden />
                  </BotonIcono>
                  <BotonIcono
                    sobre="panel"
                    aria-label={tr("Borrar {obra} para siempre", { obra: o.nombre })}
                    onClick={() => onBorrar(o)}
                  >
                    <Trash2 size={20} aria-hidden />
                  </BotonIcono>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <Aviso tono="error">{error}</Aviso>}

      {creando ? (
        <FormObraNueva
          onCancelar={() => setCreando(false)}
          onCrear={async (nombre, direccion) => {
            const fallo = await onCrear(nombre, direccion);
            if (!fallo) setCreando(false);
            return fallo;
          }}
        />
      ) : (
        <Boton variante="suave" ancho icono={<Plus size={18} aria-hidden />} onClick={() => setCreando(true)}>
          {tr("Nueva obra")}
        </Boton>
      )}
    </SeccionAjustes>
  );
}
