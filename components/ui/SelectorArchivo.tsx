"use client";

import { useRef, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { compressImageToBlob } from "@/lib/image";
import { tr } from "@/lib/i18n";
import { Cargando } from "./Cargando";
import { Aviso } from "./Aviso";

/** Lo que el usuario ha elegido y está listo para subir. */
export type ArchivoElegido = { blob: Blob; type: string; name: string; preview?: string };

/** Un PDF no puede pasar de 10 MB (v1). */
const MAX_PDF = 10 * 1024 * 1024;

/**
 * Hacer foto o elegir PDF (GAS-05). Presentacional: recibe el valor y avisa
 * con `onChange`; no sube nada (eso lo hace quien lo usa). Las fotos se
 * comprimen antes (1600 px, calidad 0,75): una foto del móvil pesa varios
 * megas y con cobertura de obra no se subía.
 *
 * Gastos y Dinero usan esta misma pieza.
 */
export function SelectorArchivo({
  archivo,
  onChange,
  id,
}: {
  archivo: ArchivoElegido | null;
  onChange: (a: ArchivoElegido | null) => void;
  /** Id del botón, para enlazarlo con la etiqueta del campo. */
  id?: string;
}) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setProcesando(true);
    try {
      // COSTURA (T-10): aquí, entre «el usuario ha hecho la foto» y «se acepta»,
      // es donde entrará el escáner de documentos (recortar/enderezar `file`
      // antes de comprimirlo). Hoy pasa tal cual.
      if (file.type === "application/pdf") {
        if (file.size > MAX_PDF) {
          setError(tr("El PDF pesa demasiado (máx. 10 MB)."));
        } else {
          onChange({ blob: file, type: "application/pdf", name: file.name });
        }
      } else {
        const blob = await compressImageToBlob(file, 1600, 0.75);
        onChange({ blob, type: "image/jpeg", name: file.name, preview: URL.createObjectURL(blob) });
      }
    } catch {
      setError(tr("No se pudo procesar el archivo. Inténtalo de nuevo."));
    }
    setProcesando(false);
  };

  const quitar = () => {
    if (archivo?.preview) URL.revokeObjectURL(archivo.preview);
    onChange(null);
  };

  return (
    <div className="grid gap-2">
      {!archivo ? (
        <button
          id={id}
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={procesando}
          className="flex min-h-14 w-full min-w-0 items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-tinta/45 px-3 py-3 text-base font-medium disabled:opacity-60"
        >
          {procesando ? <Cargando tamano="peq" /> : <Camera size={20} aria-hidden className="shrink-0" />}
          <span className="min-w-0 break-words">{procesando ? tr("Procesando…") : tr("Hacer foto o subir PDF")}</span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3 rounded-[10px] bg-fondo/60 p-2.5">
          {archivo.type === "application/pdf" ? (
            <FileText size={28} aria-hidden className="shrink-0" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={archivo.preview} alt="" className="size-12 shrink-0 rounded-[6px] object-cover" />
          )}
          <span className="min-w-0 flex-1 break-words text-peq">{archivo.name}</span>
          <button
            type="button"
            onClick={quitar}
            aria-label={tr("Quitar el archivo elegido")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-fondo/60"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          void elegir(e.target.files?.[0]);
          // Permite volver a elegir el mismo archivo tras quitarlo.
          e.target.value = "";
        }}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}
