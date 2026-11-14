"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportarError } from "@/lib/errores";
import { tr } from "@/lib/i18n";
import { Boton } from "@/components/ui/Boton";

/** Si una pantalla revienta: se avisa a /admin (PLT-03) y se ofrece reintentar. */
export default function ErrorPantalla({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportarError(error, "pantalla (error.tsx)");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center px-6 text-center">
      <AlertTriangle size={32} aria-hidden className="mb-3" />
      <h1 className="text-h1 font-medium">{tr("Algo ha fallado")}</h1>
      <p className="mb-6 mt-2 text-base">
        {tr("Ya nos ha llegado el aviso. Prueba otra vez; si sigue pasando, vuelve más tarde.")}
      </p>
      <Boton grande onClick={() => retry()} icono={<RefreshCw size={18} aria-hidden />}>
        {tr("Reintentar")}
      </Boton>
    </main>
  );
}
