"use client";

import clsx from "clsx";
import { Check, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { tr } from "@/lib/i18n";
import type { Obra } from "@/lib/types";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

/**
 * Lista de obras ACTIVAS para elegir la actual (SHL-04). Las cerradas se
 * gestionan desde Ajustes → Obras (SHL-09). «Nueva obra» solo para dueño y
 * manager (en v1 salía a todos aunque la base no les deja: §20.1).
 */
export function SelectorObra({
  obras,
  obraId,
  puedeCrear,
  onElegir,
  onCrear,
}: {
  obras: Obra[];
  obraId: string | null;
  puedeCrear: boolean;
  onElegir: (id: string) => void;
  /** Devuelve un mensaje de error o null si se creó. */
  onCrear: (nombre: string, direccion: string) => Promise<string | null>;
}) {
  const activas = obras.filter((o) => o.activa);
  const [creando, setCreando] = useState(false);

  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {activas.map((o) => {
          const actual = o.id === obraId;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onElegir(o.id)}
                aria-current={actual || undefined}
                className={clsx(
                  "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-panel px-4 py-3 text-left transition-colors",
                  actual ? "bg-sup-honda text-sobre-honda" : "bg-fondo/60 hover:bg-fondo"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-medium">{o.nombre}</span>
                  {o.direccion && (
                    <span className={clsx("mt-0.5 flex items-start gap-1 text-peq", actual ? "text-sobre-honda-2" : "text-tinta-2")}>
                      <MapPin size={14} aria-hidden className="mt-0.5 shrink-0" />
                      <span className="min-w-0 break-words">{o.direccion}</span>
                    </span>
                  )}
                </span>
                {actual && <Check size={20} aria-label={tr("Obra actual")} className="shrink-0 text-lima" />}
              </button>
            </li>
          );
        })}
      </ul>
      {puedeCrear &&
        (creando ? (
          <FormObraNueva onCrear={onCrear} onCancelar={() => setCreando(false)} />
        ) : (
          <Boton variante="suave" ancho icono={<Plus size={18} aria-hidden />} onClick={() => setCreando(true)} className="mt-1">
            {tr("Nueva obra")}
          </Boton>
        ))}
    </div>
  );
}

/** Formulario nombre + dirección (SHL-04/SHL-06). El error se enseña (en v1 se perdía: DIS-12). */
export function FormObraNueva({
  onCrear,
  onCancelar,
  boton = tr("Crear obra"),
}: {
  onCrear: (nombre: string, direccion: string) => Promise<string | null>;
  onCancelar?: () => void;
  boton?: string;
}) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 grid gap-3 rounded-panel bg-fondo/50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setGuardando(true);
        setError(null);
        const fallo = await onCrear(nombre.trim(), direccion.trim());
        setGuardando(false);
        if (fallo) setError(fallo);
      }}
    >
      <Campo etiqueta={tr("Nombre de la obra")} htmlFor="obra-nueva-nombre">
        <Entrada
          id="obra-nueva-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={tr("Ej. Demolición C/ Mayor 12")}
          required
        />
      </Campo>
      <Campo etiqueta={tr("Dirección (opcional)")} htmlFor="obra-nueva-direccion">
        <Entrada
          id="obra-nueva-direccion"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder={tr("Ej. Calle Mayor 12, Madrid")}
        />
      </Campo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" grande className="flex-1" disabled={!nombre.trim()} cargando={guardando} icono={<Plus size={18} aria-hidden />}>
          {boton}
        </Boton>
        {onCancelar && (
          <Boton variante="suave" grande onClick={onCancelar}>
            {tr("Cancelar")}
          </Boton>
        )}
      </div>
    </form>
  );
}
