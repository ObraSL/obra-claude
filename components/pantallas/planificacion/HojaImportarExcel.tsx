"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import type { ResultadoImport } from "@/lib/importar-excel";
import { fmtDate, fmtEUR } from "@/lib/format";
import { tr, trJsx, trN } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { Panel } from "@/components/ui/Panel";
import { Interruptor } from "@/components/ui/Controles";
import { Cargando } from "@/components/ui/Cargando";

/**
 * Carga del Gantt desde el Excel de la obra (PLA-04).
 *
 * Antes de guardar nada se enseña lo que se ha entendido del archivo, para
 * que se pueda comprobar de un vistazo: los Gantt de Excel se dibujan
 * pintando celdas y el año ni siquiera está escrito, así que conviene ver
 * las fechas antes de meterlas.
 *
 * `onImportar` devuelve el mensaje de error, o null si salió bien. Si falla
 * (también tras borrar lo anterior, DIS-26) la vista previa se conserva y el
 * error se ve aquí dentro para poder reintentar.
 */
export function HojaImportarExcel({
  hayTareas,
  onImportar,
  onCerrar,
}: {
  hayTareas: number;
  onImportar: (r: ResultadoImport, reemplazar: boolean) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reemplazar, setReemplazar] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const leer = async (f: File, anio?: number) => {
    setLeyendo(true);
    setError("");
    try {
      // Se carga aquí y no arriba a propósito: la librería que lee Excel
      // pesa casi un mega y no tiene por qué descargarse en el móvil de
      // quien nunca va a importar nada (T-36).
      const { leerArchivoExcel } = await import("@/lib/importar-excel");
      setResultado(await leerArchivoExcel(f, anio));
      setArchivo(f);
    } catch (e) {
      setResultado(null);
      setError(e instanceof Error ? e.message : tr("No he podido leer el archivo."));
    }
    setLeyendo(false);
  };

  const cambiarAnio = async (delta: number) => {
    if (!archivo || !resultado) return;
    await leer(archivo, resultado.anio + delta);
  };

  const guardar = async () => {
    if (!resultado) return;
    setGuardando(true);
    setError("");
    const err = await onImportar(resultado, reemplazar);
    setGuardando(false);
    if (err) setError(err);
  };

  const n = resultado?.secciones.length ?? 0;

  return (
    <Hoja
      titulo={tr("Traer el plan del Excel")}
      onCerrar={onCerrar}
      pie={
        resultado && (
          <Boton
            grande
            ancho
            cargando={guardando}
            disabled={leyendo}
            onClick={guardar}
            icono={<Upload size={18} aria-hidden />}
            data-testid="importar-guardar"
          >
            {reemplazar
              ? trN(n, "Reemplazar por este {n} capítulo", "Reemplazar por estos {n} capítulos")
              : trN(n, "Añadir este {n} capítulo", "Añadir estos {n} capítulos")}
          </Boton>
        )
      }
    >
      {!resultado ? (
        <div className="grid gap-3 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={leyendo}
            className="flex min-h-28 w-full min-w-0 flex-col items-center justify-center gap-2 rounded-[10px] bg-fondo/60 px-4 py-6 text-center"
          >
            {leyendo ? <Cargando tamano="normal" /> : <FileSpreadsheet size={28} aria-hidden />}
            <span className="min-w-0 break-words text-base font-medium">
              {leyendo ? tr("Leyendo el archivo…") : tr("Elegir el Excel del Gantt")}
            </span>
          </button>

          <p className="text-peq leading-relaxed text-tinta-2">
            {tr("Vale el Gantt tal cual lo tienes: con la fila de semanas arriba (")}
            <span className="font-medium text-tinta">{tr("WEEK 1 16.03-20.03")}</span>
            {tr("…) y las casillas pintadas de color. Cada capítulo se convierte en una tarea, con sus fechas y lo que tiene presupuestado.")}
          </p>

          <a href="/plantilla-plan-obra.xlsx" download className="inline-flex min-h-11 items-center gap-2 text-peq font-medium underline underline-offset-4">
            <Download size={16} aria-hidden className="shrink-0" />
            <span className="min-w-0 break-words">{tr("¿No tienes el plan en Excel? Descarga la plantilla")}</span>
          </a>

          {error && <Aviso tono="error">{error}</Aviso>}

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-testid="importar-archivo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) leer(f);
              // Permite volver a elegir el mismo archivo.
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 pt-1" aria-busy={leyendo || undefined}>
          <p className="text-peq text-tinta-2">
            {trJsx("Hoja {hoja}", { hoja: <strong className="font-semibold text-tinta">{resultado.hoja}</strong> })} ·{" "}
            {trN(resultado.semanas, "{n} semana", "{n} semanas")} · {trN(n, "{n} capítulo", "{n} capítulos")}
          </p>

          <Campo
            etiqueta={tr("Año del plan")}
            htmlFor="importar-anio"
            pista={tr("El Excel no guarda el año. He puesto el que hace que la primera semana empiece en lunes — compruébalo en las fechas de abajo.")}
          >
            <div className="flex items-center gap-2">
              <Boton variante="secundario" className="min-w-14" onClick={() => cambiarAnio(-1)} disabled={leyendo}>
                −
              </Boton>
              <output id="importar-anio" className="cifras min-w-0 flex-1 text-center text-titulo font-medium" data-testid="importar-anio">
                {resultado.anio}
              </output>
              <Boton variante="secundario" className="min-w-14" onClick={() => cambiarAnio(1)} disabled={leyendo}>
                +
              </Boton>
            </div>
          </Campo>

          <ul className="grid gap-2">
            {resultado.secciones.map((s, i) => (
              <li key={i} className="min-w-0 rounded-[10px] bg-fondo/60 px-3.5 py-2.5">
                <p className="break-words text-base font-medium">{s.nombre}</p>
                <p className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-peq text-tinta-2">
                  <span className="min-w-0 break-words">
                    {fmtDate(s.fecha_inicio)} – {fmtDate(s.fecha_fin)} · {trN(s.lineas, "{n} línea", "{n} líneas")}
                  </span>
                  <span className="cifras whitespace-nowrap font-medium text-tinta">{fmtEUR(s.presupuesto)}</span>
                </p>
              </li>
            ))}
          </ul>

          <Panel tono="honda" relleno="compacto" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 text-base font-medium">{tr("Presupuesto total")}</span>
            <span className="cifras whitespace-nowrap text-titulo font-medium" data-testid="importar-total">
              {fmtEUR(resultado.totalPresupuesto)}
            </span>
          </Panel>

          {resultado.avisos.length > 0 && (
            <Aviso tono="error">
              <div className="grid gap-1">
                {resultado.avisos.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
              </div>
            </Aviso>
          )}

          {hayTareas > 0 && (
            <Interruptor
              activo={reemplazar}
              onCambio={setReemplazar}
              etiqueta={trN(hayTareas, "Borrar la {n} tarea que ya hay y dejar solo estas.", "Borrar las {n} tareas que ya hay y dejar solo estas.")}
              descripcion={tr("Si lo dejas sin marcar, estas se añaden a las de ahora.")}
            />
          )}

          {error && <Aviso tono="error">{error}</Aviso>}

          <Boton
            variante="secundario"
            ancho
            onClick={() => {
              setResultado(null);
              setArchivo(null);
              setError("");
            }}
          >
            {tr("Elegir otro archivo")}
          </Boton>
        </div>
      )}
    </Hoja>
  );
}
