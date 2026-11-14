"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import type { Proveedor } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { Entrada, Selector } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";

const NUEVO = "__nuevo__";

/** Busca un proveedor de la lista sin mirar mayúsculas («leroy merlin» = «Leroy Merlin»). GAS-06. */
export const buscarProveedor = (lista: Proveedor[], nombre: string) =>
  lista.find((p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase());

/**
 * Elegir proveedor (GAS-06): los favoritos arriba (Leroy Merlin, Obramat,
 * BigMat…), los demás debajo, y «Otro» para escribir uno nuevo. Es un
 * desplegable normal del móvil a propósito: en el iPhone sale la ruedecita de
 * siempre, con los grupos separados, y no hay que aprender nada.
 */
export function SelectorProveedor({
  id,
  valor,
  onChange,
  proveedores,
  onFavorito,
}: {
  id?: string;
  valor: string;
  onChange: (nombre: string) => void;
  proveedores: Proveedor[];
  /** Devuelve el mensaje de error, o null si salió bien. */
  onFavorito: (nombre: string, favorito: boolean) => Promise<string | null>;
}) {
  const existente = valor.trim() ? buscarProveedor(proveedores, valor) : undefined;
  // Escribiendo uno nuevo: si el valor no está en la lista, o si se eligió «Otro»
  const [escribiendo, setEscribiendo] = useState(Boolean(valor.trim()) && !existente);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState("");

  const favoritos = proveedores.filter((p) => p.favorito);
  const otros = proveedores.filter((p) => !p.favorito);

  const alternarFavorito = async () => {
    const nombre = existente?.nombre ?? valor.trim();
    if (!nombre) return;
    setCambiando(true);
    setError("");
    const err = await onFavorito(nombre, !existente?.favorito);
    setCambiando(false);
    if (err) setError(err);
  };

  return (
    <div className="grid gap-1">
      {escribiendo ? (
        <div className="flex min-w-0 items-center gap-2">
          <Entrada
            id={id}
            autoFocus
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder={tr("Nombre del proveedor")}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => {
              setEscribiendo(false);
              onChange("");
            }}
            className="min-h-11 shrink-0 rounded-boton px-2 text-peq font-medium underline underline-offset-4"
          >
            {tr("Lista")}
          </button>
        </div>
      ) : (
        <Selector
          id={id}
          value={existente?.nombre ?? ""}
          onChange={(e) => {
            if (e.target.value === NUEVO) {
              setEscribiendo(true);
              onChange("");
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">{tr("— Sin proveedor —")}</option>
          {favoritos.length > 0 && (
            <optgroup label={tr("★ Favoritos")}>
              {favoritos.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          )}
          {otros.length > 0 && (
            <optgroup label={tr("Otros")}>
              {otros.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          )}
          <option value={NUEVO}>{tr("+ Otro proveedor…")}</option>
        </Selector>
      )}

      {valor.trim() && (
        <button
          type="button"
          onClick={alternarFavorito}
          disabled={cambiando}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-boton text-left text-peq font-medium disabled:opacity-60"
        >
          <Star size={18} aria-hidden className={clsx("shrink-0", existente?.favorito && "fill-current")} />
          <span className="min-w-0 break-words">
            {existente?.favorito ? tr("En favoritos · quitar") : tr("Añadir a favoritos")}
          </span>
        </button>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  );
}
