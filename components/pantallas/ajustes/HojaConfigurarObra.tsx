"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { tr } from "@/lib/i18n";
import { obtenerPosicion } from "@/lib/geo";
import type { Obra } from "@/lib/types";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada, EntradaHora } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

export type DatosUbicacionObra = {
  lat: number | null;
  lng: number | null;
  radio: number;
  hora: string;
  /** Minutos permitidos antes; si no hay hora de inicio, el valor que ya tenía la obra (no se toca). */
  min: number;
};

const RADIO_MINIMO = 20;
const RADIO_POR_DEFECTO = 150;

/**
 * Ubicación y horario de la obra (AJU-07, SOLO el dueño): de aquí salen el
 * radio (dentro/fuera al fichar) y la hora mínima para fichar la entrada. Está
 * pensada para rellenarse estando en la propia obra, tocando «Usar mi
 * ubicación actual». Opcional: sin ubicación, fichar funciona igual.
 */
export function HojaConfigurarObra({
  obra,
  onGuardar,
  onCerrar,
}: {
  obra: Obra;
  /** Devuelve un mensaje de error, o null si se guardó. */
  onGuardar: (d: DatosUbicacionObra) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [lat, setLat] = useState<number | null>(obra.lat);
  const [lng, setLng] = useState<number | null>(obra.lng);
  const [radio, setRadio] = useState(String(obra.radio_metros));
  const [horaInicio, setHoraInicio] = useState(obra.hora_inicio_turno ?? "");
  const [minutosAntes, setMinutosAntes] = useState(String(obra.minutos_antes_permitidos));
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const usarMiUbicacion = async () => {
    setBuscandoGps(true);
    setError("");
    const pos = await obtenerPosicion();
    setBuscandoGps(false);
    if (!pos) {
      setError(tr("No se pudo obtener la ubicación. Revisa el permiso de ubicación del navegador."));
      return;
    }
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
  };

  const guardar = async () => {
    setError("");
    // Radio vacío = 150 (v1); por debajo de 20 m no se guarda (en v1 el mínimo no se aplicaba, DIS-44).
    const radioNum = radio.trim() === "" ? RADIO_POR_DEFECTO : Number(radio);
    if (!Number.isFinite(radioNum) || radioNum < RADIO_MINIMO) {
      setError(tr("El radio mínimo es de {m} metros.", { m: RADIO_MINIMO }));
      return;
    }
    const minNum = Number(minutosAntes);
    if (horaInicio && (!Number.isFinite(minNum) || minNum < 0)) {
      setError(tr("Los minutos no pueden ser negativos."));
      return;
    }
    setGuardando(true);
    const fallo = await onGuardar({
      lat,
      lng,
      radio: radioNum,
      hora: horaInicio,
      // Con la hora oculta no se toca el valor que ya tenía (v1 lo pisaba, DIS-44).
      min: horaInicio ? minNum : obra.minutos_antes_permitidos,
    });
    setGuardando(false);
    if (fallo) setError(fallo);
  };

  return (
    <Hoja
      titulo={tr("Ubicación y horario · {obra}", { obra: obra.nombre })}
      onCerrar={onCerrar}
      pie={
        <Boton type="submit" form="form-ubicacion-obra" grande ancho cargando={guardando} data-testid="guardar-ubicacion">
          {tr("Guardar")}
        </Boton>
      }
    >
      <form
        id="form-ubicacion-obra"
        noValidate
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <p className="text-peq leading-relaxed text-tinta-2">
          {tr(
            "Esto es opcional: sin ubicación puesta, fichar funciona igual, solo que sin el aviso de «dentro/fuera de la obra». Sin hora de inicio, tampoco hay límite de cuándo se puede fichar la entrada."
          )}
        </p>

        <div className="grid gap-2 rounded-[10px] bg-fondo/60 p-3.5">
          <h3 className="text-peq font-medium">{tr("Ubicación de la obra")}</h3>
          {lat != null && lng != null ? (
            <p className="cifras break-words text-base">
              {tr("Puesta ({lat}, {lng})", { lat: lat.toFixed(5), lng: lng.toFixed(5) })}
            </p>
          ) : (
            <p className="text-base text-tinta-2">{tr("Todavía sin poner.")}</p>
          )}
          <Boton
            variante="secundario"
            ancho
            cargando={buscandoGps}
            onClick={usarMiUbicacion}
            icono={<MapPin size={18} aria-hidden />}
          >
            {tr("Usar mi ubicación actual")}
          </Boton>
        </div>

        <Campo etiqueta={tr("Radio que cuenta como «dentro de la obra» (metros)")} htmlFor="obra-radio">
          <Entrada
            id="obra-radio"
            type="number"
            inputMode="numeric"
            min={RADIO_MINIMO}
            step="10"
            value={radio}
            onChange={(e) => setRadio(e.target.value)}
            className="cifras"
          />
        </Campo>

        <EntradaHora
          id="obra-hora-inicio"
          etiqueta={tr("Hora de inicio del turno (opcional)")}
          textoBorrar={tr("Quitar la hora de inicio")}
          valor={horaInicio}
          onCambio={setHoraInicio}
        />

        {horaInicio && (
          <Campo etiqueta={tr("Minutos antes que se puede fichar la entrada")} htmlFor="obra-minutos">
            <Entrada
              id="obra-minutos"
              type="number"
              inputMode="numeric"
              min={0}
              step="5"
              value={minutosAntes}
              onChange={(e) => setMinutosAntes(e.target.value)}
              className="cifras"
            />
          </Campo>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Hoja>
  );
}
