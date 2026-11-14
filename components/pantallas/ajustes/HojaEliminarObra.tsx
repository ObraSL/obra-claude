"use client";

import { useState } from "react";
import { tr, trJsx } from "@/lib/i18n";
import type { Obra } from "@/lib/types";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

/**
 * Borrar una obra es irreversible (AJU-08, SOLO el dueño): fichajes, gastos,
 * fotos de recibos, audios, todo desaparece. Doble candado a propósito:
 * escribir el nombre tal cual (para no borrar la de al lado por un toque en
 * falso) y la contraseña de la cuenta (para que no sea «un toque más» sin
 * pensarlo). El botón no se activa hasta tener las dos cosas.
 */
export function HojaEliminarObra({
  obra,
  onConfirmar,
  onCerrar,
}: {
  obra: Obra;
  /** Reautentica y borra. Devuelve un mensaje de error, o null si se borró. */
  onConfirmar: (password: string) => Promise<string | null>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  const nombreOk = nombre.trim() === obra.nombre;
  const puede = nombreOk && password !== "" && !borrando;

  const eliminar = async () => {
    if (!nombreOk || !password) return;
    setBorrando(true);
    setError("");
    const fallo = await onConfirmar(password);
    setBorrando(false);
    if (fallo) setError(fallo);
  };

  return (
    <Hoja
      titulo={tr("Borrar obra")}
      onCerrar={onCerrar}
      cerrarFuera={false}
      pie={
        <Boton
          type="submit"
          form="form-borrar-obra"
          variante="peligro"
          grande
          ancho
          disabled={!puede}
          cargando={borrando}
          data-testid="borrar-obra-confirmar"
        >
          {tr("Borrar «{obra}» para siempre", { obra: obra.nombre })}
        </Boton>
      }
    >
      <form
        id="form-borrar-obra"
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          eliminar();
        }}
      >
        <Aviso tono="error">
          {trJsx(
            "Esto borra {siempre} todos los fichajes, gastos, fotos de recibos, cobros y notas de audio de «{obra}». No hay vuelta atrás y no queda copia en la app.",
            {
              siempre: <strong className="font-bold">{tr("para siempre")}</strong>,
              obra: obra.nombre,
            }
          )}
        </Aviso>

        <Campo etiqueta={tr("Escribe «{obra}» para confirmar", { obra: obra.nombre })} htmlFor="borrar-obra-nombre">
          <Entrada
            id="borrar-obra-nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (error) setError("");
            }}
            placeholder={obra.nombre}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta={tr("Tu contraseña")} htmlFor="borrar-obra-password">
          <Entrada
            id="borrar-obra-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Campo>

        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Hoja>
  );
}
