"use client";

import { useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { Cargando } from "./Cargando";
import { Aviso } from "./Aviso";

type Carga = { data: string | null; error: { message: string } | null };

/**
 * Enseña un archivo guardado (imagen o PDF) a partir de una URL firmada
 * temporal. Quien lo usa pasa `cargarUrl` (pide la URL firmada) y `clave`
 * (la ruta del archivo: si cambia, se vuelve a pedir). Estados: cargando,
 * error y listo.
 */
export function VisorArchivo({
  clave,
  tipo,
  cargarUrl,
}: {
  clave: string;
  tipo?: string | null;
  cargarUrl: () => Promise<Carga>;
}) {
  const [estado, setEstado] = useState<{ clave: string; url: string | null; error: string } | null>(null);
  const cargador = useRef(cargarUrl);
  useEffect(() => {
    cargador.current = cargarUrl;
  });

  useEffect(() => {
    let vivo = true;
    cargador.current().then(({ data, error }) => {
      if (!vivo) return;
      setEstado({ clave, url: data, error: error?.message ?? (data ? "" : tr("No se pudo cargar el archivo.")) });
    });
    return () => {
      vivo = false;
    };
  }, [clave]);

  const listo = estado?.clave === clave ? estado : null;

  if (listo && !listo.url) return <Aviso tono="error">{listo.error}</Aviso>;

  return (
    <div className="flex min-h-40 min-w-0 items-center justify-center overflow-hidden rounded-[10px] bg-fondo/60">
      {!listo ? (
        <Cargando />
      ) : tipo === "application/pdf" ? (
        <embed src={listo.url ?? undefined} type="application/pdf" className="h-[420px] w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listo.url ?? undefined} alt={tr("Recibo")} className="block w-full" />
      )}
    </div>
  );
}
