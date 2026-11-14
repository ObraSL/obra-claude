"use client";

import { useState } from "react";
import { todayStr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { SelectorArchivo, type ArchivoElegido } from "@/components/ui/SelectorArchivo";

/** Lo que el formulario entrega al contenedor para guardar un pago del cliente. */
export type ValoresCobro = {
  importe: number;
  fecha: string;
  concepto: string | null;
  archivo: ArchivoElegido | null;
};

/** Apuntar un pago del cliente, con justificante opcional (DIN-03). */
export function HojaCobro({
  onGuardar,
  onCerrar,
}: {
  /** Devuelve el mensaje de error, o null si se guardó (el contenedor cierra la hoja). */
  onGuardar: (v: ValoresCobro) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(todayStr());
  const [concepto, setConcepto] = useState("");
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const valido = Number(importe) > 0;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    setError("");
    const fallo = await onGuardar({ importe: Number(importe), fecha, concepto: concepto.trim() || null, archivo });
    if (fallo) {
      setError(fallo);
      setGuardando(false);
    }
  };

  return (
    <Hoja
      titulo={tr("Pago del cliente")}
      onCerrar={onCerrar}
      pie={
        <Boton grande ancho type="submit" form="hoja-cobro" disabled={!valido} cargando={guardando} data-testid="guardar-cobro">
          {tr("Guardar pago")}
        </Boton>
      }
    >
      <form
        id="hoja-cobro"
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <Campo etiqueta={tr("Importe (€)")} htmlFor="cobro-importe">
          <Entrada
            id="cobro-importe"
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

        <Campo etiqueta={tr("Fecha")} htmlFor="cobro-fecha">
          <Entrada id="cobro-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={todayStr()} />
        </Campo>

        <Campo etiqueta={tr("Concepto (opcional)")} htmlFor="cobro-concepto">
          <Entrada
            id="cobro-concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={tr("Ej. Primera certificación, anticipo…")}
          />
        </Campo>

        <Campo etiqueta={tr("Justificante (opcional)")} htmlFor="cobro-archivo">
          <SelectorArchivo id="cobro-archivo" archivo={archivo} onChange={setArchivo} />
        </Campo>

        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Hoja>
  );
}
