"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import clsx from "clsx";
import { tr, trJsx } from "@/lib/i18n";
import { Aviso } from "./Aviso";

/**
 * Grabador de voz del navegador.
 *
 * Ojo con el formato: Safari (iPhone) no sabe grabar en webm, graba en mp4,
 * y Android/Chrome al revés. Por eso se elige el formato que soporte cada
 * móvil en vez de forzar uno.
 */
const FORMATOS: { mime: string; ext: string }[] = [
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/aac", ext: "aac" },
  { mime: "audio/ogg", ext: "ogg" },
];

function formatoSoportado() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const f of FORMATOS) {
    if (MediaRecorder.isTypeSupported?.(f.mime)) return f;
  }
  return { mime: "", ext: "webm" };
}

export function fmtDuracion(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GrabadorAudio({
  onGrabado,
  onEmpezar,
  disabled,
}: {
  onGrabado: (blob: Blob, extension: string, segundos: number) => void;
  /**
   * Se llama al EMPEZAR a grabar (ya con el micrófono concedido). Sirve para
   * que quien guarda apunte entonces a qué obra/día pertenece la grabación,
   * por si cambia de día mientras graba.
   */
  onEmpezar?: () => void;
  disabled?: boolean;
}) {
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segundosRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Si el componente desaparece mientras graba, soltamos el micrófono.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const empezar = async () => {
    setError("");
    const formato = formatoSoportado();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      setError(tr("Este navegador no permite grabar audio. Prueba con Safari o Chrome actualizados."));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(tr("No se pudo acceder al micrófono. Revisa los permisos del navegador."));
      return;
    }

    const recorder = new MediaRecorder(stream, formato.mime ? { mimeType: formato.mime } : undefined);
    chunksRef.current = [];
    segundosRef.current = 0;
    setSegundos(0);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || formato.mime });
      setGrabando(false);
      if (blob.size > 0) onGrabado(blob, formato.ext, segundosRef.current);
    };

    onEmpezar?.();
    recorder.start();
    recorderRef.current = recorder;
    setGrabando(true);
    intervalRef.current = setInterval(() => {
      segundosRef.current += 1;
      setSegundos(segundosRef.current);
    }, 1000);
  };

  const parar = () => recorderRef.current?.stop();

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={grabando ? parar : empezar}
        disabled={!grabando && disabled}
        data-testid={grabando ? "parar-grabacion" : "grabar-nota"}
        className={clsx(
          "flex min-h-24 w-full min-w-0 select-none items-center justify-center gap-3 rounded-hoja px-5 py-4 text-center",
          "transition-[filter,transform] duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45",
          grabando ? "bg-coral text-sobre-coral" : "bg-lima text-sobre-lima hover:brightness-[1.04] active:brightness-95"
        )}
      >
        {grabando ? (
          <>
            <Square size={26} fill="currentColor" aria-hidden className="shrink-0" />
            <span className="min-w-0 break-words text-titulo font-medium" aria-live="off">
              {trJsx("Parar · {tiempo}", {
                tiempo: <span className="cifras text-cifra font-light leading-none tracking-[-0.04em]">{fmtDuracion(segundos)}</span>,
              })}
            </span>
          </>
        ) : (
          <>
            <Mic size={28} aria-hidden className="shrink-0" />
            <span className="min-w-0 break-words text-titulo font-medium">{tr("Grabar nota de voz")}</span>
          </>
        )}
      </button>
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}
