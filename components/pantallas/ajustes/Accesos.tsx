"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, Check, Copy, IdCard, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { tr, trJsx } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  actualizarMiembro,
  crearTrabajador,
  eliminarMiembro,
  leerCodigoEmpresa,
  listarMiembros,
  trabajadoresTodos,
  type CambiosMiembro,
} from "@/lib/datos/consultas";
import { useMiembro } from "@/lib/miembro-context";
import { useObra } from "@/lib/obra-context";
import { ROLES, type Miembro, type Rol, type Trabajador } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { Boton } from "@/components/ui/Boton";
import { Hoja } from "@/components/ui/Hoja";
import { Aviso } from "@/components/ui/Aviso";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { CargandoBloque } from "@/components/ui/Cargando";
import { SeccionAjustes } from "./SeccionListaActivable";

/** Etiqueta de un rol, traducida (v1 la enseñaba siempre en español: DIS-36). */
const etiquetaRol = (rol: Rol) => tr(ROLES.find((r) => r.id === rol)?.label ?? rol);

const mensaje = (err: { message: string }) =>
  esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message;

/**
 * Accesos (AJU-02, SOLO el dueño): quién puede entrar y hasta dónde llega.
 * Nadie puede subirse el nivel a sí mismo: cambiar roles es cosa del dueño
 * (así está también en la base de datos). La lista solo cambia cuando la
 * base confirma el cambio, y cualquier error se enseña (DIS-23).
 */
export function Accesos() {
  const db = useDb();
  const { miembro: yo, userId } = useMiembro();
  const { obras } = useObra();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [codigoEmpresa, setCodigoEmpresa] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [abierto, setAbierto] = useState<Miembro | null>(null);
  const [errorHoja, setErrorHoja] = useState("");
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);
  const [origen, setOrigen] = useState("");

  const cargar = useCallback(async () => {
    const [m, t, e] = await Promise.all([listarMiembros(db), trabajadoresTodos(db), leerCodigoEmpresa(db)]);
    setCargando(false);
    const fallo = m.error ?? t.error ?? e.error;
    if (fallo) {
      setErrorCarga(mensaje(fallo));
      return;
    }
    setErrorCarga("");
    setMiembros(m.data ?? []);
    setTrabajadores(t.data ?? []);
    setCodigoEmpresa(e.data?.codigo ?? null);
  }, [db]);

  useEffect(() => {
    setOrigen(window.location.origin);
    void cargar();
  }, [cargar]);

  const actualizar = async (id: string, cambios: CambiosMiembro) => {
    setErrorHoja("");
    const { data, error } = await actualizarMiembro(db, id, cambios);
    if (error) {
      setErrorHoja(mensaje(error));
      return;
    }
    if (data) {
      setMiembros((prev) => prev.map((m) => (m.user_id === id ? data : m)));
      setAbierto((a) => (a && a.user_id === id ? data : a));
    }
  };

  const eliminar = async (id: string) => {
    setErrorHoja("");
    const { error } = await eliminarMiembro(db, id);
    if (error) {
      // v1 lo quitaba de la lista aunque la base lo rechazara (DIS-23).
      setErrorHoja(mensaje(error));
      return;
    }
    setMiembros((prev) => prev.filter((m) => m.user_id !== id));
    setAbierto(null);
  };

  const crearFicha = async (m: Miembro) => {
    if (!userId || !m.nombre) return;
    setErrorHoja("");
    const { data, error } = await crearTrabajador(db, userId, m.nombre);
    if (error) {
      setErrorHoja(mensaje(error));
      return;
    }
    if (data) {
      setTrabajadores((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      await actualizar(m.user_id, { trabajador_id: data.id });
    }
  };

  const enlaceInvitacion = codigoEmpresa && origen ? `${origen}/login?empresa=${codigoEmpresa}` : null;

  const copiarEnlace = async () => {
    if (!enlaceInvitacion) return;
    // El portapapeles puede no estar disponible (http, permisos): v1 no lo
    // contemplaba aquí (DIS-63).
    try {
      await navigator.clipboard.writeText(enlaceInvitacion);
      setCopiado("si");
    } catch {
      setCopiado("no");
    }
    setTimeout(() => setCopiado(null), 2500);
  };

  const pendientes = miembros.filter((m) => !m.aprobado);
  const activos = miembros.filter((m) => m.aprobado);

  return (
    <SeccionAjustes titulo={tr("Accesos")} testid="ajustes-accesos">
      {cargando ? (
        <CargandoBloque alto="bloque" />
      ) : (
        <>
          {errorCarga && <Aviso tono="error">{errorCarga}</Aviso>}

          {enlaceInvitacion && (
            <div className="grid gap-2.5 rounded-[10px] bg-fondo/60 p-3">
              <h3 className="text-base font-medium">{tr("Enlace para invitar a tu equipo")}</h3>
              <p className="cifras select-all break-all rounded-[6px] bg-campo px-3 py-2.5 text-peq text-sobre-campo">{enlaceInvitacion}</p>
              <Boton variante="secundario" ancho onClick={copiarEnlace} icono={<Copy size={18} aria-hidden />}>
                {copiado === "si" ? tr("¡Copiado!") : tr("Copiar enlace")}
              </Boton>
              {copiado === "no" && <Aviso tono="info">{tr("No se ha podido copiar. Mantén pulsado el enlace para copiarlo.")}</Aviso>}
            </div>
          )}

          {pendientes.length > 0 && (
            <div className="grid gap-2">
              <h3 className="flex items-center gap-1.5 text-base font-medium">
                <UserPlus size={18} aria-hidden /> {tr("Esperando tu aprobación ({n})", { n: pendientes.length })}
              </h3>
              <ul className="grid gap-2">
                {pendientes.map((m) => (
                  <li key={m.user_id}>
                    <FilaMiembro
                      m={m}
                      onClick={() => {
                        setErrorHoja("");
                        setAbierto(m);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="grid gap-2">
            {activos.map((m) => (
              <li key={m.user_id}>
                <FilaMiembro
                  m={m}
                  esYo={m.user_id === yo?.user_id}
                  obraNombre={obras.find((o) => o.id === m.obra_id)?.nombre}
                  onClick={() => {
                    if (m.user_id === yo?.user_id) return;
                    setErrorHoja("");
                    setAbierto(m);
                  }}
                />
              </li>
            ))}
          </ul>

          <p className="rounded-[10px] bg-fondo/60 px-3 py-2.5 text-peq leading-relaxed">
            {trJsx(
              "Quien se registre con su correo aparecerá aquí como {pendiente}. Hasta que tú no le des acceso, no ve nada de las obras.",
              { pendiente: <strong className="font-semibold">{tr("pendiente")}</strong> }
            )}
          </p>
        </>
      )}

      {abierto && (
        <HojaMiembro
          m={abierto}
          obras={obras}
          trabajadores={trabajadores}
          error={errorHoja}
          onActualizar={(cambios) => actualizar(abierto.user_id, cambios)}
          onCrearFicha={() => crearFicha(abierto)}
          onEliminar={() => eliminar(abierto.user_id)}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </SeccionAjustes>
  );
}

function FilaMiembro({ m, esYo, obraNombre, onClick }: { m: Miembro; esYo?: boolean; obraNombre?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={esYo}
      className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[10px] bg-fondo/60 px-3 py-2.5 text-left hover:bg-fondo disabled:cursor-default disabled:hover:bg-fondo/60"
    >
      <span aria-hidden className={clsx("inline-flex size-10 shrink-0 items-center justify-center rounded-[8px]", m.aprobado ? "bg-sup-honda text-sobre-honda" : "bg-coral text-sobre-coral")}>
        {m.aprobado ? <BadgeCheck size={20} /> : <UserPlus size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-base font-semibold">
          {m.nombre || m.email}
          {esYo && <span className="ml-1.5 text-peq font-normal">{tr("(tú)")}</span>}
        </span>
        {m.nombre && <span className="block break-all text-peq text-tinta-2">{m.email}</span>}
        {obraNombre && <span className="block break-words text-peq text-tinta-2">{obraNombre}</span>}
      </span>
      {m.aprobado ? <Etiqueta tono="honda">{etiquetaRol(m.rol)}</Etiqueta> : <Etiqueta tono="coral">{tr("Pendiente")}</Etiqueta>}
    </button>
  );
}

function HojaMiembro({
  m,
  obras,
  trabajadores,
  error,
  onActualizar,
  onCrearFicha,
  onEliminar,
  onCerrar,
}: {
  m: Miembro;
  obras: { id: string; nombre: string }[];
  trabajadores: Trabajador[];
  error: string;
  onActualizar: (cambios: CambiosMiembro) => Promise<void>;
  onCrearFicha: () => Promise<void>;
  onEliminar: () => Promise<void>;
  onCerrar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const fichaExistente = trabajadores.some((t) => t.id === m.trabajador_id);

  const hacer = async (trabajo: () => Promise<void>) => {
    setOcupado(true);
    await trabajo();
    setOcupado(false);
  };

  return (
    <Hoja
      titulo={m.nombre || m.email}
      subtitulo={<span className="break-all">{m.email}</span>}
      onCerrar={onCerrar}
      pie={
        m.aprobado ? (
          <Boton variante="secundario" grande ancho disabled={ocupado} onClick={() => hacer(() => onActualizar({ aprobado: false }))}>
            {tr("Suspender acceso")}
          </Boton>
        ) : (
          <Boton grande ancho cargando={ocupado} onClick={() => hacer(() => onActualizar({ aprobado: true }))} icono={<Check size={20} aria-hidden />}>
            {tr("Dar acceso")}
          </Boton>
        )
      }
    >
      <div className="grid gap-5 pt-1">
        {error && <Aviso tono="error">{error}</Aviso>}

        <Bloque icono={ShieldCheck} titulo={tr("Nivel de acceso")}>
          <div role="radiogroup" aria-label={tr("Nivel de acceso")} className="grid gap-2">
            {ROLES.map((r) => {
              const activo = m.rol === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  disabled={ocupado}
                  // Elegir un rol que no es jefe de obra le quita la obra asignada (como v1).
                  onClick={() => hacer(() => onActualizar({ rol: r.id, ...(r.id !== "jefe_obra" ? { obra_id: null } : {}) }))}
                  className={clsx(
                    "flex min-h-14 w-full items-start gap-3 rounded-[10px] px-3.5 py-3 text-left",
                    activo ? "bg-negro text-sobre-negro" : "bg-fondo/60 hover:bg-fondo"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{tr(r.label)}</span>
                    <span className={clsx("mt-0.5 block text-peq leading-snug", activo ? "text-white/85" : "text-tinta-2")}>
                      {tr(r.descripcion)}
                    </span>
                  </span>
                  {activo && <Check size={20} aria-hidden className="mt-0.5 shrink-0 text-lima" />}
                </button>
              );
            })}
          </div>
        </Bloque>

        {m.rol === "jefe_obra" && (
          <Bloque icono={Building2} titulo={tr("Obra que lleva")}>
            <div className="grid gap-2">
              {obras.map((o) => (
                <Opcion key={o.id} activa={m.obra_id === o.id} disabled={ocupado} onClick={() => hacer(() => onActualizar({ obra_id: o.id }))}>
                  {o.nombre}
                </Opcion>
              ))}
            </div>
          </Bloque>
        )}

        {m.rol === "trabajador" && (
          <Bloque icono={IdCard} titulo={tr("Ficha de trabajador")}>
            <p className="mb-2 text-peq leading-relaxed">{tr("Enlaza esta cuenta con su ficha para que sus horas se apunten donde toca.")}</p>
            <div className="grid gap-2">
              {trabajadores.map((t) => (
                <Opcion key={t.id} activa={m.trabajador_id === t.id} disabled={ocupado} onClick={() => hacer(() => onActualizar({ trabajador_id: t.id }))}>
                  {t.nombre}
                </Opcion>
              ))}
            </div>
            {m.nombre && !fichaExistente && (
              <Boton variante="suave" ancho className="mt-2" disabled={ocupado} onClick={() => hacer(onCrearFicha)} icono={<UserPlus size={18} aria-hidden />}>
                {tr("Crear ficha «{nombre}»", { nombre: m.nombre })}
              </Boton>
            )}
          </Bloque>
        )}

        {!confirmando ? (
          <Boton variante="suave" ancho onClick={() => setConfirmando(true)} icono={<Trash2 size={18} aria-hidden />}>
            {tr("Eliminar de la lista")}
          </Boton>
        ) : (
          <div className="flex flex-wrap gap-2" role="group">
            <Boton variante="suave" className="flex-1" onClick={() => setConfirmando(false)}>
              {tr("Cancelar")}
            </Boton>
            <Boton variante="peligro" className="flex-1" cargando={ocupado} onClick={() => hacer(onEliminar)}>
              {tr("Sí, eliminar")}
            </Boton>
          </div>
        )}
      </div>
    </Hoja>
  );
}

function Bloque({ icono: Icono, titulo, children }: { icono: typeof ShieldCheck; titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-base font-medium">
        <Icono size={18} aria-hidden /> {titulo}
      </h3>
      {children}
    </section>
  );
}

function Opcion({ activa, disabled, onClick, children }: { activa: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-[10px] px-3.5 py-2.5 text-left text-base font-medium",
        activa ? "bg-negro text-sobre-negro" : "bg-fondo/60 hover:bg-fondo"
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
      {activa && <Check size={18} aria-hidden className="shrink-0 text-lima" />}
    </button>
  );
}
