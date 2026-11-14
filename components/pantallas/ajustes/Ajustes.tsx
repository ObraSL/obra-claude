"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { tr, trJsx } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  cambiarActivoTrabajador,
  cambiarActivoVehiculo,
  crearTrabajador,
  crearVehiculo,
  guardarUbicacionHorarioObra,
  reautenticar,
  trabajadoresTodos,
  vehiculosTodos,
} from "@/lib/datos/consultas";
import { eliminarObraDefinitivamente } from "@/lib/eliminar-obra";
import { useMiembro } from "@/lib/miembro-context";
import { useObra } from "@/lib/obra-context";
import { useTema } from "@/lib/tema-provider";
import { LISTA_MODULOS } from "@/lib/modulos";
import { ROLES, type Obra, type Trabajador, type Vehiculo } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Interruptor } from "@/components/ui/Controles";
import { SelectorIdioma } from "@/components/ui/SelectorIdioma";
import { useSalir } from "@/components/puertas/PantallaPuerta";
import { Accesos } from "./Accesos";
import { SoporteAcceso } from "./SoporteAcceso";
import { SeccionObras } from "./SeccionObras";
import { SeccionAjustes, SeccionListaActivable } from "./SeccionListaActivable";
import { SelectorTema } from "./SelectorTema";
import { HojaConfigurarObra, type DatosUbicacionObra } from "./HojaConfigurarObra";
import { HojaEliminarObra } from "./HojaEliminarObra";

const mensaje = (err: { message: string }) =>
  esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message;

/** Ajustes: variante de gestor o de trabajador (§14). */
export function Ajustes() {
  const { esTrabajador } = useMiembro();
  return esTrabajador ? <AjustesTrabajador /> : <AjustesGestor />;
}

/**
 * Ajustes de gestor (AJU-01…AJU-09). El orden lo manda la especificación:
 * idioma y tema (todos) · Accesos, Soporte, Jornada, Jefe de obra, Módulos
 * (SOLO el dueño) · Obras, Trabajadores, Vehículos (dueño y manager).
 * El jefe de obra solo ve idioma, tema y cerrar sesión.
 */
function AjustesGestor() {
  const db = useDb();
  const router = useRouter();
  const salir = useSalir("/login");
  const { tema, cambiarTema } = useTema();
  const { obras, setObraId, crearObra, toggleObraActiva, refrescar, jornadaHoras, guardarJornada, jefeVeTodas, guardarJefeVeTodas } =
    useObra();
  const { esDueno, administra, modulos, guardarModulo, email, userId } = useMiembro();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargandoListas, setCargandoListas] = useState(true);
  const [errorListas, setErrorListas] = useState("");
  const [configurando, setConfigurando] = useState<Obra | null>(null);
  const [borrando, setBorrando] = useState<Obra | null>(null);
  const [errorArriba, setErrorArriba] = useState("");

  const cargarListas = useCallback(async () => {
    if (!administra) {
      setCargandoListas(false);
      return;
    }
    const [t, v] = await Promise.all([trabajadoresTodos(db), vehiculosTodos(db)]);
    setCargandoListas(false);
    const fallo = t.error ?? v.error;
    if (fallo) {
      setErrorListas(mensaje(fallo));
      return;
    }
    setErrorListas("");
    setTrabajadores(t.data ?? []);
    setVehiculos(v.data ?? []);
  }, [db, administra]);

  useEffect(() => {
    void cargarListas();
  }, [cargarListas]);

  const guardarUbicacion = async (obra: Obra, d: DatosUbicacionObra) => {
    const { error } = await guardarUbicacionHorarioObra(db, obra.id, d);
    if (error) return mensaje(error);
    setConfigurando(null);
    await refrescar();
    return null;
  };

  /**
   * Borrar obra (AJU-08): doble candado. El nombre exacto lo comprueba la
   * hoja; aquí se reautentica con la contraseña y, solo entonces, se borran
   * primero los archivos del Storage y después todo en una transacción.
   */
  const borrarObra = async (obra: Obra, password: string) => {
    if (!email) return tr("No se pudo guardar. Inténtalo otra vez.");
    const { error: errAuth } = await reautenticar(db, email, password);
    if (errAuth) {
      return errAuth.message === "Invalid login credentials" ? tr("Contraseña incorrecta. Vuelve a escribirla.") : errAuth.message;
    }
    const fallo = await eliminarObraDefinitivamente(db, obra.id);
    if (fallo) return fallo;
    setBorrando(null);
    await refrescar();
    router.push("/");
    return null;
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-h1 font-medium tracking-[-0.02em]">{tr("Ajustes")}</h1>

      {errorArriba && <Aviso tono="error">{errorArriba}</Aviso>}

      <SeccionAjustes titulo={tr("Idioma")} testid="ajustes-idioma">
        <SelectorIdioma sobre="panel" />
      </SeccionAjustes>

      <SelectorTema tema={tema} onCambio={cambiarTema} />

      {esDueno && (
        <>
          <Accesos />
          <SoporteAcceso />
          <SeccionJornada jornadaHoras={jornadaHoras} onGuardar={guardarJornada} />

          <SeccionAjustes titulo={tr("Jefe de obra")} testid="ajustes-jefe">
            <Interruptor
              activo={jefeVeTodas}
              onCambio={async (v) => {
                const fallo = await guardarJefeVeTodas(v);
                if (fallo) setErrorArriba(fallo);
              }}
              etiqueta={trJsx("Deja que el jefe de obra vea {todas} de la empresa, no solo la que tiene asignada.", {
                todas: <strong className="font-semibold">{tr("todas las obras")}</strong>,
              })}
              descripcion={jefeVeTodas ? tr("Activado") : tr("Desactivado")}
            />
          </SeccionAjustes>

          <SeccionAjustes
            titulo={tr("Módulos")}
            descripcion={tr("Apaga lo que tu empresa no use: desaparece del menú y de las pantallas de todos. No se borra nada.")}
            testid="ajustes-modulos"
          >
            <div className="grid gap-1">
              {LISTA_MODULOS.map((m) => (
                <Interruptor
                  key={m.clave}
                  activo={modulos[m.clave]}
                  onCambio={async (v) => {
                    const fallo = await guardarModulo(m.clave, v);
                    if (fallo) setErrorArriba(fallo);
                  }}
                  etiqueta={tr(m.label)}
                  descripcion={tr(m.descripcion)}
                />
              ))}
            </div>
          </SeccionAjustes>
        </>
      )}

      {administra && (
        <>
          <SeccionObras
            obras={obras}
            esDueno={esDueno}
            onAbrir={(id) => {
              setObraId(id);
              router.push("/");
            }}
            onCambiarActiva={toggleObraActiva}
            onCrear={async (nombre, direccion) => {
              const { error } = await crearObra(nombre, direccion);
              return error;
            }}
            onConfigurar={setConfigurando}
            onBorrar={setBorrando}
          />

          <SeccionListaActivable
            titulo={tr("Trabajadores")}
            filas={trabajadores}
            cargando={cargandoListas}
            errorCarga={errorListas}
            textoVacio={tr("Todavía no hay trabajadores.")}
            placeholder={tr("Ej. Andrés Gómez")}
            etiquetaNuevo={tr("Nuevo trabajador")}
            etiquetaCampo={tr("Nombre")}
            testid="ajustes-trabajadores"
            onCambiarActivo={async (id, activo) => {
              const { data, error } = await cambiarActivoTrabajador(db, id, activo);
              if (error) return mensaje(error);
              if (data) setTrabajadores((prev) => prev.map((t) => (t.id === id ? data : t)));
              return null;
            }}
            onAnadir={async (nombre) => {
              const { data, error } = await crearTrabajador(db, userId ?? "", nombre);
              if (error) return mensaje(error);
              if (data) setTrabajadores((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
              return null;
            }}
          />

          <SeccionListaActivable
            titulo={tr("Vehículos")}
            filas={vehiculos}
            cargando={cargandoListas}
            errorCarga={errorListas}
            textoVacio={tr("Todavía no hay vehículos.")}
            placeholder={tr("Ej. Furgoneta — 1234 ABC")}
            etiquetaNuevo={tr("Nuevo vehículo")}
            etiquetaCampo={tr("Nombre")}
            testid="ajustes-vehiculos"
            onCambiarActivo={async (id, activo) => {
              const { data, error } = await cambiarActivoVehiculo(db, id, activo);
              if (error) return mensaje(error);
              if (data) setVehiculos((prev) => prev.map((v) => (v.id === id ? data : v)));
              return null;
            }}
            onAnadir={async (nombre) => {
              const { data, error } = await crearVehiculo(db, userId ?? "", nombre);
              if (error) return mensaje(error);
              if (data) setVehiculos((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
              return null;
            }}
          />
        </>
      )}

      {/* En el ordenador, «Cerrar sesión» ya está en la barra lateral (ACC-14). */}
      <Boton variante="secundario" grande ancho className="md:hidden" onClick={salir} icono={<LogOut size={20} aria-hidden />}>
        {tr("Cerrar sesión")}
      </Boton>

      {configurando && (
        <HojaConfigurarObra obra={configurando} onGuardar={(d) => guardarUbicacion(configurando, d)} onCerrar={() => setConfigurando(null)} />
      )}
      {borrando && esDueno && (
        <HojaEliminarObra obra={borrando} onConfirmar={(password) => borrarObra(borrando, password)} onCerrar={() => setBorrando(null)} />
      )}
    </div>
  );
}

/** AJU-04 — Horas de una jornada normal: de ahí sale lo que cuenta como horas extra. */
function SeccionJornada({ jornadaHoras, onGuardar }: { jornadaHoras: number; onGuardar: (h: number) => Promise<string | null> }) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const valor = texto === "" ? String(jornadaHoras) : texto;
  const num = Number(valor);
  // v1 dejaba guardar 0,5 porque el campo no estaba en un formulario (AJU-04).
  const valida = Number.isFinite(num) && num >= 1 && num <= 24;

  return (
    <SeccionAjustes
      titulo={tr("Jornada")}
      descripcion={trJsx("Horas de una jornada normal. Lo que pase de ahí en un día cuenta como {extra}.", {
        extra: <strong className="font-semibold">{tr("horas extra")}</strong>,
      })}
      testid="ajustes-jornada"
    >
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valida || num === jornadaHoras) return;
          setGuardando(true);
          setError("");
          const fallo = await onGuardar(num);
          setGuardando(false);
          if (fallo) setError(fallo);
          else setTexto("");
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <Campo etiqueta={tr("Horas")} htmlFor="ajustes-jornada-horas" className="flex-1">
            <Entrada
              id="ajustes-jornada-horas"
              type="number"
              inputMode="decimal"
              min={1}
              max={24}
              step="0.5"
              value={valor}
              onChange={(e) => setTexto(e.target.value)}
              aria-invalid={!valida || undefined}
            />
          </Campo>
          <Boton type="submit" disabled={!valida || num === jornadaHoras} cargando={guardando}>
            {tr("Guardar")}
          </Boton>
        </div>
        {!valida && <Aviso tono="error">{tr("Tienen que ser entre 1 y 24 horas.")}</Aviso>}
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </SeccionAjustes>
  );
}

/** AJU-W1 — Ajustes de un trabajador: solo su cuenta, idioma y tema. */
function AjustesTrabajador() {
  const salir = useSalir("/");
  const { tema, cambiarTema } = useTema();
  const { miembro } = useMiembro();

  return (
    <div className="grid gap-4">
      <h1 className="text-h1 font-medium tracking-[-0.02em]">{tr("Ajustes")}</h1>

      <SeccionAjustes titulo={tr("Mi cuenta")} testid="ajustes-cuenta">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold">{miembro?.nombre || "—"}</p>
          <p className="mt-0.5 break-all text-peq text-tinta-2">{miembro?.email}</p>
          <p className="mt-3">
            <Etiqueta tono="honda">{tr(ROLES.find((r) => r.id === miembro?.rol)?.label ?? "")}</Etiqueta>
          </p>
          <p className="mt-3 text-peq leading-relaxed text-tinta-2">
            {tr("Si algo de esto no está bien, díselo al jefe: él lo cambia desde su cuenta.")}
          </p>
        </div>
      </SeccionAjustes>

      <SeccionAjustes titulo={tr("Idioma")} testid="ajustes-idioma">
        <SelectorIdioma sobre="panel" />
      </SeccionAjustes>

      <SelectorTema tema={tema} onCambio={cambiarTema} />

      <Boton variante="secundario" grande ancho onClick={salir} icono={<LogOut size={20} aria-hidden />}>
        {tr("Cerrar sesión")}
      </Boton>
    </div>
  );
}
