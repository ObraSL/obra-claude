"use client";

import clsx from "clsx";
import { useState } from "react";
import { tr, trN } from "@/lib/i18n";
import { todayStr } from "@/lib/format";
import { duracionDias } from "@/lib/gantt";
import type { Tarea } from "@/lib/types";
import type { CamposTarea } from "@/lib/datos/consultas/tareas";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { BorrarDosPasos } from "@/components/ui/Controles";

/**
 * Alta y edición de una tarea del plan (PLA-03). Al editar aparece el borrado
 * en dos pasos. Los errores del servidor se enseñan DENTRO de la hoja (PLA-06):
 * `onGuardar` / `onBorrar` devuelven el mensaje, o null si salió bien.
 */
export function HojaTarea({
  tarea,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  tarea?: Tarea;
  onGuardar: (datos: CamposTarea) => Promise<string | null>;
  onBorrar?: () => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(tarea?.nombre ?? "");
  const [inicio, setInicio] = useState(tarea?.fecha_inicio ?? todayStr());
  const [fin, setFin] = useState(tarea?.fecha_fin ?? todayStr());
  const [avance, setAvance] = useState(tarea?.avance ?? 0);
  const [presupuesto, setPresupuesto] = useState(tarea?.presupuesto != null ? String(tarea.presupuesto) : "");
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  const fechasAlReves = fin < inicio;
  const valido = nombre.trim().length > 0 && inicio !== "" && fin !== "" && !fechasAlReves;

  const guardar = async () => {
    if (!valido) return;
    setGuardando(true);
    setError("");
    const err = await onGuardar({
      nombre: nombre.trim(),
      fecha_inicio: inicio,
      fecha_fin: fin,
      avance,
      presupuesto: presupuesto.trim() === "" ? null : Number(presupuesto),
    });
    setGuardando(false);
    if (err) setError(err);
  };

  const borrar = async () => {
    if (!onBorrar) return;
    setBorrando(true);
    setError("");
    const err = await onBorrar();
    setBorrando(false);
    if (err) setError(err);
  };

  return (
    <Hoja
      titulo={tarea ? tr("Tarea") : tr("Nueva tarea")}
      onCerrar={onCerrar}
      pie={
        <Boton grande ancho type="submit" form="form-tarea" disabled={!valido} cargando={guardando} data-testid="guardar-tarea">
          {tarea ? tr("Guardar cambios") : tr("Añadir tarea")}
        </Boton>
      }
    >
      <form
        id="form-tarea"
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Campo etiqueta={tr("Tarea")} htmlFor="tarea-nombre">
          <Entrada
            id="tarea-nombre"
            autoFocus={!tarea}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tr("Ej. Cimentación, Estructura, Tabiquería…")}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <Campo etiqueta={tr("Empieza")} htmlFor="tarea-inicio">
            <Entrada id="tarea-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo etiqueta={tr("Termina")} htmlFor="tarea-fin">
            <Entrada id="tarea-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} aria-invalid={fechasAlReves || undefined} />
          </Campo>
        </div>

        {fechasAlReves ? (
          <Aviso tono="error">{tr("La fecha de fin no puede ser anterior a la de inicio.")}</Aviso>
        ) : (
          inicio &&
          fin && (
            <p className="text-peq text-tinta-2" data-testid="duracion-tarea">
              {trN(duracionDias({ fecha_inicio: inicio, fecha_fin: fin }), "Dura {n} día.", "Dura {n} días.")}
            </p>
          )
        )}

        <Campo etiqueta={tr("Avance — {pct}%", { pct: avance })} htmlFor="tarea-avance">
          <input
            id="tarea-avance"
            type="range"
            min={0}
            max={100}
            step={5}
            value={avance}
            onChange={(e) => setAvance(Number(e.target.value))}
            className="block h-11 w-full accent-negro"
          />
          <div className="mt-1 flex gap-1.5">
            {[0, 25, 50, 75, 100].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={avance === v}
                onClick={() => setAvance(v)}
                className={clsx(
                  "cifras min-h-11 min-w-0 flex-1 rounded-boton px-1 text-peq font-medium transition-colors",
                  avance === v ? "bg-negro text-sobre-negro" : "bg-fondo/60 text-tinta hover:bg-fondo"
                )}
              >
                {v}%
              </button>
            ))}
          </div>
        </Campo>

        <Campo etiqueta={tr("Presupuesto (€, opcional)")} htmlFor="tarea-presupuesto">
          <Entrada
            id="tarea-presupuesto"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            placeholder={tr("Lo que hay previsto para esta parte")}
            className="cifras"
          />
        </Campo>

        {error && <Aviso tono="error">{tr("No se ha podido guardar:")} {error}</Aviso>}

        {onBorrar && (
          <BorrarDosPasos
            texto={tr("Borrar tarea")}
            confirmar={tr("Tocar otra vez para borrarla de verdad")}
            cargando={borrando}
            onBorrar={borrar}
          />
        )}
      </form>
    </Hoja>
  );
}
