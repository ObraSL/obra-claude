"use client";

import { useState } from "react";
import { todayStr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada, Selector } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

/** Lo que el formulario entrega al contenedor para guardar dinero del jefe. */
export type ValoresEntrega = {
  importe: number;
  fecha: string;
  concepto: string | null;
  obraId: string | null;
};

/** Apuntar dinero que dio el jefe (DIN-05). La obra es opcional: es dinero general. */
export function HojaEntrega({
  obras,
  onGuardar,
  onCerrar,
}: {
  obras: { id: string; nombre: string }[];
  /** Devuelve el mensaje de error, o null si se guardó (el contenedor cierra la hoja). */
  onGuardar: (v: ValoresEntrega) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [concepto, setConcepto] = useState("");
  const [obraId, setObraId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const valido = Number(importe) > 0;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    setError("");
    const fallo = await onGuardar({
      importe: Number(importe),
      fecha,
      concepto: concepto.trim() || null,
      obraId: obraId || null,
    });
    if (fallo) {
      setError(fallo);
      setGuardando(false);
    }
  };

  return (
    <Hoja
      titulo={tr("Dinero del jefe")}
      onCerrar={onCerrar}
      pie={
        <Boton grande ancho type="submit" form="hoja-entrega" disabled={!valido} cargando={guardando} data-testid="guardar-entrega">
          {tr("Guardar")}
        </Boton>
      }
    >
      <form
        id="hoja-entrega"
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <Campo etiqueta={tr("Importe (€)")} htmlFor="entrega-importe">
          <Entrada
            id="entrega-importe"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="0,00"
            className="cifras"
          />
        </Campo>

        <Campo etiqueta={tr("Fecha")} htmlFor="entrega-fecha">
          <Entrada id="entrega-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={todayStr()} />
        </Campo>

        <Campo etiqueta={tr("Concepto (opcional)")} htmlFor="entrega-concepto">
          <Entrada
            id="entrega-concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={tr("Ej. Para gastos, sueldos de la semana…")}
          />
        </Campo>

        {/* El dinero del jefe es general: la obra solo si ayuda a acordarse. */}
        <Campo etiqueta={tr("Obra (opcional)")} htmlFor="entrega-obra">
          <Selector id="entrega-obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">{tr("— En general, no de una obra —")}</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Selector>
        </Campo>

        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Hoja>
  );
}
