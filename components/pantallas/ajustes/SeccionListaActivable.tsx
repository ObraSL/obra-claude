"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { Panel } from "@/components/ui/Panel";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { Cargando } from "@/components/ui/Cargando";

/** Sección de Ajustes: un Panel con su h2 y, si hace falta, una línea de explicación. */
export function SeccionAjustes({
  titulo,
  descripcion,
  children,
  testid,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <Panel como="section" tono="sup" data-testid={testid} className="grid gap-3">
      <div className="min-w-0">
        <h2 className="text-titulo font-medium tracking-[-0.01em]">{titulo}</h2>
        {descripcion && <p className="mt-1 text-peq text-tinta-2">{descripcion}</p>}
      </div>
      {children}
    </Panel>
  );
}

/**
 * Botón de estado (Activo/Baja, Activa/Cerrada): la palabra va siempre escrita,
 * nunca solo el color. Alto mínimo 44 px.
 */
export function BotonEstado({
  activo,
  textoActivo,
  textoInactivo,
  onClick,
  cargando,
  etiqueta,
}: {
  activo: boolean;
  textoActivo: string;
  textoInactivo: string;
  onClick: () => void;
  cargando?: boolean;
  /** Nombre accesible (p. ej. con el nombre de la fila). */
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      aria-pressed={activo}
      aria-label={etiqueta}
      aria-busy={cargando || undefined}
      className={clsx(
        "inline-flex min-h-11 min-w-20 shrink-0 items-center justify-center rounded-boton px-3 text-peq font-medium leading-tight transition-[filter,transform] active:scale-95 disabled:opacity-50",
        activo ? "bg-lima text-sobre-lima" : "bg-fondo text-tinta"
      )}
    >
      {activo ? textoActivo : textoInactivo}
    </button>
  );
}

export type FilaActivable = { id: string; nombre: string; activo: boolean };

/**
 * Lista con interruptor Activo/Baja y alta en línea. Se usa para Trabajadores
 * y Vehículos. NUNCA se borra: un trabajador borrado se llevaría sus horas
 * (AJU-09); solo se da de baja. Los cambios solo se pintan cuando la base los
 * confirma, y el error del servidor se enseña tal cual.
 */
export function SeccionListaActivable({
  titulo,
  filas,
  cargando,
  errorCarga,
  textoVacio,
  placeholder,
  etiquetaNuevo,
  etiquetaCampo,
  testid,
  onCambiarActivo,
  onAnadir,
}: {
  titulo: string;
  filas: FilaActivable[];
  cargando: boolean;
  errorCarga?: string;
  textoVacio: string;
  placeholder: string;
  /** Texto del botón «Nuevo …». */
  etiquetaNuevo: string;
  /** Etiqueta visible del campo de nombre. */
  etiquetaCampo: string;
  testid: string;
  /** Devuelven un mensaje de error, o null si salió bien. */
  onCambiarActivo: (id: string, activo: boolean) => Promise<string | null>;
  onAnadir: (nombre: string) => Promise<string | null>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState("");
  const [errorFila, setErrorFila] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cambiar = async (f: FilaActivable) => {
    setErrorFila("");
    setOcupada(f.id);
    const fallo = await onCambiarActivo(f.id, !f.activo);
    setOcupada(null);
    if (fallo) setErrorFila(fallo);
  };

  const anadir = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    setGuardando(true);
    setErrorAlta("");
    const fallo = await onAnadir(limpio);
    setGuardando(false);
    if (fallo) {
      setErrorAlta(fallo);
      return;
    }
    setNombre("");
    setAbierto(false);
  };

  return (
    <SeccionAjustes titulo={titulo} testid={testid}>
      {errorCarga && <Aviso tono="error">{errorCarga}</Aviso>}
      {cargando ? (
        <div className="flex justify-center py-6">
          <Cargando />
        </div>
      ) : filas.length === 0 ? (
        !errorCarga && <p className="py-2 text-peq text-tinta-2">{textoVacio}</p>
      ) : (
        <ul className="grid gap-2">
          {filas.map((f) => (
            <li key={f.id} className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-[10px] bg-fondo/60 px-3.5 py-2">
              <span className="min-w-0 break-words text-base font-semibold">{f.nombre}</span>
              <BotonEstado
                activo={f.activo}
                textoActivo={tr("Activo")}
                textoInactivo={tr("Baja")}
                cargando={ocupada === f.id}
                onClick={() => cambiar(f)}
              />
            </li>
          ))}
        </ul>
      )}
      {errorFila && <Aviso tono="error">{errorFila}</Aviso>}

      {abierto ? (
        <form
          className="grid gap-3 rounded-[10px] bg-fondo/60 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            anadir();
          }}
        >
          <Campo etiqueta={etiquetaCampo} htmlFor={`${testid}-nombre`}>
            <Entrada
              id={`${testid}-nombre`}
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={placeholder}
            />
          </Campo>
          {errorAlta && <Aviso tono="error">{errorAlta}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" className="flex-1" disabled={!nombre.trim()} cargando={guardando}>
              {tr("Añadir")}
            </Boton>
            <Boton
              variante="suave"
              onClick={() => {
                setAbierto(false);
                setNombre("");
                setErrorAlta("");
              }}
            >
              {tr("Cancelar")}
            </Boton>
          </div>
        </form>
      ) : (
        <Boton variante="suave" ancho icono={<Plus size={18} aria-hidden />} onClick={() => setAbierto(true)}>
          {etiquetaNuevo}
        </Boton>
      )}
    </SeccionAjustes>
  );
}
