"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { tr } from "@/lib/i18n";
import { fmtDateLong } from "@/lib/format";
import type { Obra, Trabajador, UsoVehiculo } from "@/lib/types";
import { Hoja } from "@/components/ui/Hoja";
import { Boton, BotonIcono } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { Campo, Entrada, Selector } from "@/components/ui/Campo";

export type DatosUso = { obra_id: string; conductor_id: string | null; destino: string };

type Props = {
  nombre: string;
  fecha: string;
  usos: UsoVehiculo[];
  obras: Obra[];
  trabajadores: Trabajador[];
  obraPorDefecto: string;
  /** Falso para el trabajador: solo ve, sin añadir ni cambiar ni quitar nada. */
  puedeEditar: boolean;
  /** Devuelve el fallo, si lo hay. */
  onGuardar: (datos: DatosUso, usoId?: string) => Promise<string | null>;
  onBorrar: (usoId: string) => Promise<string | null>;
  onCerrar: () => void;
};

/** Texto de la segunda línea de un apunte: conductor y destino, tal como en v1. */
function detalle(conductor: string | undefined, destino: string | null) {
  return [conductor ? tr("Lo llevó {nombre}", { nombre: conductor }) : null, destino].filter(Boolean).join(" · ");
}

/**
 * Hoja de un vehículo en un día (VEH-03): las obras a las que fue, con
 * editar / quitar (con confirmación), «Añadir otra obra este día» y el
 * formulario conductor / obra / nota. El trabajador la ve solo de lectura.
 */
export function HojaVehiculoDia(p: Props) {
  // Sin nada apuntado ese día, se abre directamente el formulario (como v1).
  const [editando, setEditando] = useState<UsoVehiculo | "nuevo" | null>(p.puedeEditar && p.usos.length === 0 ? "nuevo" : null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const nombreObra = (id: string) => p.obras.find((o) => o.id === id)?.nombre ?? tr("Otra obra");
  const nombreConductor = (id: string | null) => p.trabajadores.find((t) => t.id === id)?.nombre;
  // Las obras que ya tienen apunte ese día no se ofrecen otra vez.
  const yaApuntadas = new Set(p.usos.map((u) => u.obra_id));
  const libres = p.obras.filter((o) => !yaApuntadas.has(o.id));

  if (editando && p.puedeEditar) {
    const uso = editando === "nuevo" ? undefined : editando;
    const opciones = uso ? p.obras.filter((o) => o.id === uso.obra_id || !yaApuntadas.has(o.id)) : libres;
    return (
      <FormUso
        key={uso?.id ?? "nuevo"}
        nombre={p.nombre}
        fecha={p.fecha}
        uso={uso}
        obras={opciones}
        obraPorDefecto={opciones.some((o) => o.id === p.obraPorDefecto) ? p.obraPorDefecto : (opciones[0]?.id ?? "")}
        trabajadores={p.trabajadores}
        onVolver={p.usos.length > 0 ? () => setEditando(null) : undefined}
        onCerrar={p.onCerrar}
        onGuardar={async (datos) => {
          const err = await p.onGuardar(datos, uso?.id);
          if (!err) setEditando(null);
          return err;
        }}
      />
    );
  }

  const quitar = async (id: string) => {
    setError("");
    setQuitandoId(id);
    const err = await p.onBorrar(id);
    setQuitandoId(null);
    if (err) setError(err);
    setBorrando(null);
  };

  return (
    <Hoja titulo={p.nombre} subtitulo={fmtDateLong(p.fecha)} onCerrar={p.onCerrar}>
      {p.usos.length === 0 ? (
        <p className="pt-2 text-base">{tr("Sin usar este día.")}</p>
      ) : (
        <ul className="grid gap-2 pt-2">
          {p.usos.map((u) => {
            const texto = detalle(nombreConductor(u.conductor_id), u.destino);
            const fila = (
              <>
                <span className="flex min-w-0 items-start gap-1.5">
                  <MapPin size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words text-base font-semibold">{nombreObra(u.obra_id)}</span>
                </span>
                <span className="mt-0.5 block break-words text-peq text-tinta-2">
                  {texto || (p.puedeEditar ? tr("Toca para añadir conductor o notas") : tr("Sin más detalles"))}
                </span>
              </>
            );
            return (
              <li key={u.id} className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 rounded-[10px] bg-fondo/60 p-3" data-testid="uso-vehiculo">
                  {p.puedeEditar ? (
                    <button type="button" onClick={() => setEditando(u)} className="min-h-12 min-w-0 flex-1 text-left">
                      {fila}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">{fila}</div>
                  )}
                  {p.puedeEditar &&
                    (borrando === u.id ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Boton variante="peligro" cargando={quitandoId === u.id} onClick={() => quitar(u.id)}>
                          {tr("Quitar")}
                        </Boton>
                        <Boton variante="suave" onClick={() => setBorrando(null)}>
                          {tr("Cancelar")}
                        </Boton>
                      </div>
                    ) : (
                      <BotonIcono sobre="panel" onClick={() => setBorrando(u.id)} aria-label={tr("Quitar esta obra del día")}>
                        <Trash2 size={18} aria-hidden />
                      </BotonIcono>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <Aviso tono="error" className="mt-3">
          {error}
        </Aviso>
      )}

      {p.puedeEditar && libres.length > 0 && (
        <Boton variante="suave" ancho className="mt-3" icono={<Plus size={18} aria-hidden />} onClick={() => setEditando("nuevo")}>
          {tr("Añadir otra obra este día")}
        </Boton>
      )}
    </Hoja>
  );
}

function FormUso({
  nombre,
  fecha,
  uso,
  obras,
  obraPorDefecto,
  trabajadores,
  onVolver,
  onCerrar,
  onGuardar,
}: {
  nombre: string;
  fecha: string;
  uso?: UsoVehiculo;
  obras: Obra[];
  obraPorDefecto: string;
  trabajadores: Trabajador[];
  onVolver?: () => void;
  onCerrar: () => void;
  onGuardar: (datos: DatosUso) => Promise<string | null>;
}) {
  const [obraId, setObraId] = useState(uso?.obra_id ?? obraPorDefecto);
  const [conductorId, setConductorId] = useState(uso?.conductor_id ?? "");
  const [destino, setDestino] = useState(uso?.destino ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const err = await onGuardar({ obra_id: obraId, conductor_id: conductorId || null, destino });
    setGuardando(false);
    if (err) setError(err);
  };

  return (
    <Hoja
      titulo={nombre}
      subtitulo={fmtDateLong(fecha)}
      onCerrar={onCerrar}
      pie={
        <div className="grid gap-2">
          <Boton grande ancho disabled={!obraId} cargando={guardando} onClick={guardar} data-testid="guardar-uso">
            {tr("Guardar")}
          </Boton>
          {onVolver && (
            <Boton variante="suave" ancho onClick={onVolver}>
              {tr("Volver")}
            </Boton>
          )}
        </div>
      }
    >
      <div className="grid gap-3.5 pt-2">
        {trabajadores.length > 0 && (
          <Campo etiqueta={tr("¿Quién lo llevó? (opcional)")} htmlFor="uso-conductor">
            <Selector id="uso-conductor" value={conductorId} onChange={(e) => setConductorId(e.target.value)}>
              <option value="">{tr("Sin especificar")}</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        )}

        <Campo etiqueta={tr("¿A qué obra fue?")} htmlFor="uso-obra">
          <Selector id="uso-obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta={tr("¿Dónde más tuvo que ir? (opcional)")} htmlFor="uso-destino">
          <Entrada
            id="uso-destino"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder={tr("Ej. Leroy Merlin, vertedero, almacén…")}
            autoComplete="off"
          />
        </Campo>

        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Hoja>
  );
}
