"use client";

import { useEffect } from "react";
import { reportarError } from "@/lib/errores";

/**
 * Último recurso: falla hasta el layout de la app. Aquí no hay estilos ni
 * idiomas (Next no los carga), así que va en los tres idiomas y con estilos
 * a mano, en los colores del tema salvia.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportarError(error, "global-error");
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#6b7867", color: "#ffffff" }}>
        <div style={{ maxWidth: 360, margin: "20vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>
            Algo ha fallado · Щось пішло не так · Something went wrong
          </h1>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 20,
              minHeight: 52,
              padding: "12px 22px",
              borderRadius: 6,
              border: 0,
              background: "#d5e09c",
              color: "#141613",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Reintentar · Спробувати ще · Retry
          </button>
        </div>
      </body>
    </html>
  );
}
