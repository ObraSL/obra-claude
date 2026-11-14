"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIAS_GASTO, type Gasto, type Obra, type PagadoPor, type Proveedor } from "@/lib/types";
import { todayStr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada, Selector } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { SelectorArchivo, type ArchivoElegido } from "@/components/ui/SelectorArchivo";
import { PagadoPorSelector } from "@/components/ui/PagadoPor";
import { SelectorProveedor } from "./SelectorProveedor";

/** Lo que el formulario entrega al contenedor para guardar. */
export type ValoresGasto = {
  obraId: string;
  proveedor: string;
  /** Nota final: la que escribió el usuario o, si no la tocó, la que ya tenía (DIS-07). */
  concepto: string | null;
  importe: number;
  categoria: string;
  fecha: string;
  pagadoPor: PagadoPor;
  archivo: ArchivoElegido | null;
};

export type ResultadoGuardar = { error: string } | { gasto: Gasto };

/** Alta y cambio de un gasto (GAS-05). Con `gasto` se está cambiando uno que ya existe. */
export function HojaGasto({
  obras,
  obraIdInicial,
  gasto,
  esDueno,
  proveedores,
  onFavorito,
  onGuardar,
  onGuardado,
  onCerrar,
}: {
  obras: Obra[];
  obraIdInicial: string;
  gasto?: Gasto;
  esDueno: boolean;
  proveedores: Proveedor[];
  /** Deja el proveedor en la lista con ese favorito; devuelve su nombre guardado y/o el error. */
  onFavorito: (nombre: string, favorito: boolean) => Promise<{ nombre: string | null; error: string | null }>;
  onGuardar: (v: ValoresGasto) => Promise<ResultadoGuardar>;
  onGuardado: (g: Gasto) => void;
  onCerrar: () => void;
}) {
  const [obraId, setObraId] = useState(gasto?.obra_id ?? obraIdInicial);
  // «Lo pagué yo» cuenta en la caja del dueño: solo él puede marcarlo
  const [pagadoPor, setPagadoPor] = useState<PagadoPor>(gasto?.pagado_por ?? "empresa");
  const [proveedor, setProveedor] = useState(gasto?.proveedor ?? "");
  const [nota, setNota] = useState(
    gasto?.concepto && gasto.concepto !== gasto.proveedor && gasto.concepto !== "Factura" ? gasto.concepto : ""
  );
  // DIS-07: si no se toca la nota, se conserva el concepto que ya tenía la
  // factura antigua («Factura» o el proveedor repetido, que aquí no se enseña).
  const [notaTocada, setNotaTocada] = useState(false);
  const [importe, setImporte] = useState(gasto ? String(gasto.importe) : "");
  const [categoria, setCategoria] = useState<string>(gasto?.categoria ?? CATEGORIAS_GASTO[0]);
  const [fecha, setFecha] = useState(gasto?.fecha ?? todayStr());
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardadoEnOtra, setGuardadoEnOtra] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  const valido = Number(importe) > 0;
  // Si una categoría vieja ya no está en la lista, se sigue pudiendo elegir
  const categorias: string[] = CATEGORIAS_GASTO.includes(categoria as (typeof CATEGORIAS_GASTO)[number])
    ? [...CATEGORIAS_GASTO]
    : [...CATEGORIAS_GASTO, categoria];

  const guardar = async () => {
    if (!valido || guardando || guardadoEnOtra) return;
    setGuardando(true);
    setError("");
    const res = await onGuardar({
      obraId,
      proveedor,
      concepto: notaTocada ? nota.trim() || null : (gasto?.concepto ?? null),
      importe: Number(importe),
      categoria,
      fecha,
      pagadoPor,
      archivo,
    });
    if ("error" in res) {
      setError(res.error);
      setGuardando(false);
      return;
    }
    if (obraId !== obraIdInicial) {
      const nombre = obras.find((o) => o.id === obraId)?.nombre || "";
      setGuardadoEnOtra(tr("Guardado en «{obra}»", { obra: nombre }));
      temporizador.current = setTimeout(() => onGuardado(res.gasto), 900);
    } else {
      onGuardado(res.gasto);
    }
  };

  return (
    <Hoja
      titulo={gasto ? tr("Cambiar gasto") : tr("Nuevo gasto")}
      onCerrar={onCerrar}
      pie={
        <Boton
          grande
          ancho
          type="submit"
          form="hoja-gasto"
          disabled={!valido || !!guardadoEnOtra}
          cargando={guardando}
          data-testid="guardar-gasto"
        >
          {gasto ? tr("Guardar cambios") : tr("Guardar gasto")}
        </Boton>
      }
    >
      <form
        id="hoja-gasto"
        className="grid gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {obras.length > 1 && (
          <Campo etiqueta={tr("Obra")} htmlFor="gasto-obra">
            <Selector id="gasto-obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        )}

        <Campo
          etiqueta={gasto?.recibo_path ? tr("Foto del ticket o factura") : tr("Foto del ticket o factura (opcional)")}
          htmlFor="gasto-archivo"
          pista={gasto?.recibo_path && !archivo ? tr("Ya tiene foto. Si eliges otra, sustituye a la de ahora.") : undefined}
        >
          <SelectorArchivo id="gasto-archivo" archivo={archivo} onChange={setArchivo} />
        </Campo>

        <Campo etiqueta={tr("Proveedor")} htmlFor="gasto-proveedor">
          <SelectorProveedor
            id="gasto-proveedor"
            valor={proveedor}
            onChange={setProveedor}
            proveedores={proveedores}
            onFavorito={async (nombre, fav) => {
              const res = await onFavorito(nombre, fav);
              if (res.nombre) setProveedor(res.nombre);
              return res.error;
            }}
          />
        </Campo>

        <Campo etiqueta={tr("Importe (€)")} htmlFor="gasto-importe">
          <Entrada
            id="gasto-importe"
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

        <Campo etiqueta={tr("Categoría")} htmlFor="gasto-categoria">
          <Selector id="gasto-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {tr(c)}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta={tr("Fecha")} htmlFor="gasto-fecha">
          <Entrada id="gasto-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={todayStr()} />
        </Campo>

        {/* Antes era «Concepto» y obligatorio, y no se sabía qué poner: lo que
            es el gasto ya lo dicen el proveedor y la categoría. */}
        <Campo etiqueta={tr("Nota (opcional)")} htmlFor="gasto-nota">
          <Entrada
            id="gasto-nota"
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              setNotaTocada(true);
            }}
            placeholder={tr("Ej. Azulejos del baño de la 2ª planta")}
          />
        </Campo>

        {esDueno && (
          <Campo etiqueta={tr("¿Quién lo pagó?")}>
            <PagadoPorSelector valor={pagadoPor} onChange={setPagadoPor} />
          </Campo>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}
        {guardadoEnOtra && <Aviso tono="ok">{guardadoEnOtra}</Aviso>}
      </form>
    </Hoja>
  );
}
