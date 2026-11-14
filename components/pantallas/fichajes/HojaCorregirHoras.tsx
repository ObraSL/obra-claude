"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { localeActual, tr, trJsx } from "@/lib/i18n";
import { fmtDateLong } from "@/lib/format";
import { fmtHoras, minutosTrabajados } from "@/lib/horas";
import type { FichajeHistorial, Obra } from "@/lib/types";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, EntradaHora, Selector } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

/** Fecha y hora de un cambio, en el idioma activo (v1 lo fijaba a es-ES: §20.3). */
const fmtCambio = (iso: string) =>
  new Date(iso).toLocaleString(localeActual(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * «Corregir horas» — SOLO EL DUEÑO (FIC-20…FIC-24; la base lo impone con
 * triggers, aquí solo se refleja). El dueño pone la hora buena cuando alguien
 * se olvidó de fichar; queda marcado como corregido para que se vea siempre
 * que esa hora no se fichó en el momento, y el trabajador tendrá que
 * confirmarla.
 */
export function HojaCorregirHoras({
  nombre,
  fecha,
  entrada,
  salida,
  hayFichaje,
  otrasObras,
  historial,
  nombreObra,
  onGuardar,
  onMoverObra,
  onCerrar,
}: {
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  /** Existe la fila del día (si no, no hay nada que mover de obra). */
  hayFichaje: boolean;
  /** Otras obras activas a las que mover el fichaje. */
  otrasObras: Obra[];
  historial: FichajeHistorial[];
  nombreObra: (id: string) => string;
  /** Devuelven el mensaje de error, o null si salió bien. */
  onGuardar: (entrada: string | null, salida: string | null) => Promise<string | null>;
  onMoverObra: (nuevaObraId: string) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [e, setE] = useState(entrada ?? "");
  const [s, setS] = useState(salida ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [nuevaObra, setNuevaObra] = useState("");
  const [errorMover, setErrorMover] = useState("");
  const [movidoA, setMovidoA] = useState<string | null>(null);

  const min = minutosTrabajados(e || null, s || null);
  // Sin nada escrito no hay nada que guardar: en v1 se podía crear un
  // fichaje «vacío» solo abriendo y tocando «Guardar horas», y luego chocaba
  // al mover de obra ese día (T-30). No es un error en rojo: solo no deja.
  const vacio = !e && !s;
  const problema =
    s && !e
      ? tr("Pon también la hora de entrada.")
      : e && s && min === null
        ? tr("La salida tiene que ser después de la entrada.")
        : "";

  const guardar = async (entradaFinal: string | null, salidaFinal: string | null) => {
    setGuardando(true);
    setError("");
    const err = await onGuardar(entradaFinal, salidaFinal);
    setGuardando(false);
    if (err) setError(err);
  };

  const mover = async () => {
    if (!nuevaObra) return;
    setMoviendo(true);
    setErrorMover("");
    const err = await onMoverObra(nuevaObra);
    setMoviendo(false);
    if (err) {
      setErrorMover(err);
      return;
    }
    setMovidoA(otrasObras.find((o) => o.id === nuevaObra)?.nombre ?? tr("otra obra"));
  };

  return (
    <Hoja
      titulo={tr("Corregir horas")}
      subtitulo={
        <>
          <strong className="font-semibold">{nombre}</strong> · {fmtDateLong(fecha)}
        </>
      }
      onCerrar={onCerrar}
      pie={
        <Boton
          grande
          ancho
          disabled={!!problema || vacio}
          cargando={guardando}
          onClick={() => guardar(e || null, s || null)}
          data-testid="guardar-horas"
        >
          {tr("Guardar horas")}
        </Boton>
      }
    >
      <div className="grid gap-4 pt-1">
        {(entrada || salida) && (
          <p className="rounded-[10px] bg-fondo/60 px-3.5 py-2.5 text-base">
            {tr("Fichado ahora:")}{" "}
            <strong className="cifras whitespace-nowrap font-semibold">
              {entrada ?? "—"} → {salida ?? "—"}
            </strong>
          </p>
        )}

        {/* El error del día: se fichó en la obra equivocada. Mueve el día
            entero (mismas horas) a la obra correcta, sin borrar y rehacer. */}
        {hayFichaje && otrasObras.length > 0 && (
          <section className="rounded-[10px] bg-fondo/60 p-3.5">
            <h3 className="mb-2 text-base font-medium">{tr("¿Fichado en la obra equivocada?")}</h3>
            {movidoA ? (
              <Aviso tono="ok">
                <span className="inline-flex items-start gap-1.5">
                  <Check size={16} aria-hidden className="mt-0.5 shrink-0" />
                  {tr("Movido a {obra}. Ya puedes cerrar esta ventana.", { obra: movidoA })}
                </span>
              </Aviso>
            ) : (
              <div className="grid gap-2.5">
                <Campo etiqueta={tr("Elige la obra correcta…")} htmlFor="corregir-obra">
                  <Selector id="corregir-obra" value={nuevaObra} onChange={(ev) => setNuevaObra(ev.target.value)}>
                    <option value="">{tr("Elige la obra correcta…")}</option>
                    {otrasObras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                {/* Dos pasos a propósito (elegir y confirmar); el botón dice
                    adónde mueve para que no se confunda con «Guardar horas». */}
                <Boton variante="secundario" ancho disabled={!nuevaObra} cargando={moviendo} onClick={mover}>
                  {nuevaObra
                    ? tr("Mover a {obra}", { obra: otrasObras.find((o) => o.id === nuevaObra)?.nombre ?? "" })
                    : tr("Elige una obra arriba")}
                </Boton>
                {errorMover && <Aviso tono="error">{errorMover}</Aviso>}
              </div>
            )}
          </section>
        )}

        {/* Cada hora lleva su «×» (T-09): en el iPhone el selector de hora
            no se puede dejar vacío, y sin esto no había forma de quitar solo
            la salida. */}
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <EntradaHora
            id="corregir-entrada"
            etiqueta={tr("Entrada")}
            textoBorrar={tr("Quitar la hora de entrada")}
            valor={e}
            onCambio={setE}
            invalido={!!problema && !e}
          />
          <EntradaHora
            id="corregir-salida"
            etiqueta={tr("Salida")}
            textoBorrar={tr("Quitar la hora de salida")}
            valor={s}
            onCambio={setS}
            invalido={!!problema && !!e}
          />
        </div>

        {problema ? (
          <Aviso tono="error">{problema}</Aviso>
        ) : min !== null ? (
          <p className="text-base" data-testid="total-correccion">
            {tr("En total:")} <strong className="cifras font-semibold">{fmtHoras(min)}</strong>
          </p>
        ) : null}

        <p className="text-peq leading-relaxed text-tinta-2">
          {tr("Quedará marcado como «corregido por el dueño», en tu móvil y en el suyo.")}
        </p>

        {error && <Aviso tono="error">{error}</Aviso>}

        {historial.length > 0 && (
          <section className="rounded-[10px] bg-fondo/60 p-3.5">
            <h3 className="mb-2 text-base font-medium">{tr("Historial de cambios")}</h3>
            <ul className="grid gap-1.5">
              {historial.map((h) => (
                <li key={h.id} className="text-peq leading-snug">
                  {h.obra_id_despues ? (
                    trJsx("Movido de {antes} a {despues}", {
                      antes: <strong className="font-semibold">{nombreObra(h.obra_id_antes ?? "")}</strong>,
                      despues: <strong className="font-semibold">{nombreObra(h.obra_id_despues)}</strong>,
                    })
                  ) : (
                    <>
                      <span className="cifras whitespace-nowrap">
                        {h.hora_entrada_antes ?? "—"} → {h.hora_salida_antes ?? "—"}
                      </span>
                      {tr(" pasó a ")}
                      <strong className="cifras whitespace-nowrap font-semibold">
                        {h.hora_entrada_despues ?? "—"} → {h.hora_salida_despues ?? "—"}
                      </strong>
                    </>
                  )}
                  {" · "}
                  <span className="cifras whitespace-nowrap">{fmtCambio(h.cambiado_en)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cuando lo apuntaron por error y ese día no vino: el día deja de
            contar, pero queda la marca de que lo quitó el dueño (FIC-24). */}
        {(entrada || salida) &&
          (!confirmandoQuitar ? (
            <Boton
              variante="suave"
              ancho
              disabled={guardando}
              onClick={() => setConfirmandoQuitar(true)}
              icono={<Trash2 size={18} aria-hidden />}
            >
              {tr("Quitar este día (no vino)")}
            </Boton>
          ) : (
            <Boton variante="peligro" ancho disabled={guardando} onClick={() => guardar(null, null)} data-testid="quitar-dia-confirmar">
              {tr("Toca otra vez: {nombre} no cuenta este día", { nombre })}
            </Boton>
          ))}
      </div>
    </Hoja>
  );
}
