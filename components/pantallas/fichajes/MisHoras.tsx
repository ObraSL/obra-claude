"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  confirmarHorasCorregidas,
  ficharConGeovalla,
  guardarTransporte,
  guardarZonaFichaje,
  historialFichaje,
  horasDelMesDeTrabajador,
  miFichajeDelDia,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Fichaje, Transporte } from "@/lib/types";
import { esFalloDeRed, useFichajesPendientes } from "@/lib/offline-fichajes";
import { distanciaMetros, obtenerPosicion } from "@/lib/geo";
import { currentMonth, monthBounds, nowHHMM, todayStr } from "@/lib/format";
import { totalesFichajes } from "@/lib/horas";
import { useEnRefresco } from "@/components/shell/Refresco";
import { Hoja } from "@/components/ui/Hoja";
import { SelectorObra } from "@/components/shell/SelectorObra";
import { FaltaUnPaso, VistaMisHoras } from "./VistaMisHoras";

/**
 * Contenedor de «Mis horas» (vista del trabajador, FIC-30…FIC-38): datos,
 * permisos, cola sin conexión y errores. La vista solo recibe props.
 */
export function MisHoras() {
  const db = useDb();
  const { obras, obraActual, obraId, setObraId, jornadaHoras } = useObra();
  const { miembro, modulos, userId } = useMiembro();

  const hoy = todayStr();
  const [fecha, setFecha] = useState(hoy);
  const [fichaje, setFichaje] = useState<Fichaje | null>(null);
  const [mes, setMes] = useState({ trabajados: 0, extra: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recien, setRecien] = useState<"hora_entrada" | "hora_salida" | null>(null);
  const [cambioAjeno, setCambioAjeno] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cambiandoObra, setCambiandoObra] = useState(false);
  const fichando = useRef(false);

  const trabajadorId = miembro?.trabajador_id ?? null;
  const esHoy = fecha === hoy;
  const obraActualId = obraActual?.id ?? null;

  const { pendientes, encolar } = useFichajesPendientes(
    db,
    (data) => {
      // Un reintento de la cola puede traer un fichaje de otra obra u otro
      // día: solo se pinta si es el que se está mirando (DIS-16).
      if (data.obra_id !== obraActualId || data.fecha !== fecha || data.trabajador_id !== trabajadorId) return;
      setFichaje(data);
    },
    // FIC-08: un error de negocio de la cola se enseña, no se traga (DIS-11).
    (_item, mensaje) => setError(mensaje)
  );
  const pendienteDe = (campo: "hora_entrada" | "hora_salida") =>
    pendientes.some((p) => p.trabajadorId === trabajadorId && p.obraId === obraActualId && p.fecha === fecha && p.campo === campo);
  const pendienteEntrada = pendienteDe("hora_entrada");
  const pendienteSalida = pendienteDe("hora_salida");

  const cargar = useCallback(async () => {
    if (!obraActualId || !trabajadorId) return;
    const { desde, hasta } = monthBounds(currentMonth());
    const [delDia, delMes] = await Promise.all([
      miFichajeDelDia(db, obraActualId, trabajadorId, fecha),
      // Del mes cuentan TODAS las obras: puede haber estado en varias.
      horasDelMesDeTrabajador(db, trabajadorId, desde, hasta),
    ]);
    setCargando(false);
    if (delDia.error || delMes.error) {
      const fallo = delDia.error ?? delMes.error;
      // Sin cobertura se deja lo que ya había en pantalla; cualquier otro fallo se enseña.
      if (!esFalloDeRed(fallo)) setError(fallo?.message ?? "");
      else setError(tr("Sin conexión. No se han podido cargar tus horas."));
      return;
    }
    const fila = delDia.data ?? null;
    setFichaje(fila);
    const t = totalesFichajes(delMes.data ?? [], jornadaHoras);
    setMes({ trabajados: t.trabajados, extra: t.extra });

    // ¿Quién hizo el último cambio? La base baja «confirmado» con CUALQUIER
    // cambio de horas u obra, también con la salida que ficha el propio
    // trabajador; solo se le pide confirmar lo que cambió otra persona
    // (v1 pedía confirmar hasta su propia salida: DIS-19).
    if (fila && fila.confirmado_trabajador === false) {
      const { data: historial } = await historialFichaje(db, fila.id);
      const ultimo = historial?.[0];
      setCambioAjeno(ultimo ? ultimo.cambiado_por !== userId : fila.hora_corregida);
    } else {
      setCambioAjeno(false);
    }
  }, [db, obraActualId, trabajadorId, fecha, jornadaHoras, userId]);

  useEffect(() => {
    setCargando(true);
    setError("");
    setRecien(null);
    cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  /** Zona, transporte, confirmación: escrituras normales (sin cola). */
  const escribir = async (trabajo: () => ReturnType<typeof guardarZonaFichaje>) => {
    setError("");
    const { data, error: err } = await trabajo();
    if (err) setError(esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message);
    if (data) setFichaje(data);
    await cargar();
  };

  /**
   * Entrada/salida: si no hay cobertura no se pierde el toque — queda en
   * cola en el móvil y se envía solo en cuanto vuelva la señal (FIC-08).
   * La hora que vale es la del servidor: se enseña lo que DEVUELVE (FIC-02).
   */
  const fichar = async (campo: "hora_entrada" | "hora_salida") => {
    if (!obraActual || !trabajadorId || fichando.current) return;
    fichando.current = true;
    setError("");
    const hora = nowHHMM();

    // Dentro/fuera del radio de la obra (FIC-07): no se guarda dónde está el
    // móvil, solo el resultado y la distancia. Sin ubicación en la obra, sin
    // permiso o sin GPS se ficha igual: esto informa, nunca bloquea.
    let ubicacionOk: boolean | null = null;
    let distancia: number | null = null;
    if (modulos.geolocalizacion && obraActual.lat != null && obraActual.lng != null) {
      const pos = await obtenerPosicion();
      if (pos) {
        distancia = distanciaMetros(obraActual.lat, obraActual.lng, pos.coords.latitude, pos.coords.longitude);
        ubicacionOk = distancia <= obraActual.radio_metros;
      }
    }

    const { data, error: err } = await ficharConGeovalla(db, obraActual.id, trabajadorId, fecha, campo, hora, ubicacionOk, distancia);
    fichando.current = false;
    if (data) {
      setFichaje(data);
      setRecien(campo);
      await cargar();
      return;
    }
    if (esFalloDeRed(err)) {
      encolar({ obraId: obraActual.id, trabajadorId, fecha, campo, hora, ubicacionOk, distanciaMetros: distancia });
      return;
    }
    if (err) setError(err.message);
  };

  // Cuenta creada pero sin enlazar con su ficha: no hay dónde apuntar horas (ACC-12).
  if (!trabajadorId) return <FaltaUnPaso />;
  if (!obraActual) return null;

  return (
    <>
      <VistaMisHoras
        cargando={cargando}
        obraNombre={obraActual.nombre}
        fecha={fecha}
        esHoy={esHoy}
        fichaje={fichaje}
        mes={mes}
        jornadaHoras={jornadaHoras}
        error={error}
        pendienteEntrada={pendienteEntrada}
        pendienteSalida={pendienteSalida}
        recien={recien}
        porConfirmar={Boolean(fichaje && fichaje.confirmado_trabajador === false && cambioAjeno)}
        moduloTransporte={modulos.transporte}
        confirmando={confirmando}
        onFecha={setFecha}
        onCambiarObra={() => setCambiandoObra(true)}
        onFichar={fichar}
        onConfirmar={async () => {
          setConfirmando(true);
          await escribir(() => confirmarHorasCorregidas(db, obraActual.id, trabajadorId, fecha));
          setConfirmando(false);
        }}
        onGuardarZona={(zona) => escribir(() => guardarZonaFichaje(db, obraActual.id, trabajadorId, fecha, zona))}
        onGuardarTransporte={(t: Transporte, traidoPor) =>
          escribir(() => guardarTransporte(db, obraActual.id, trabajadorId, fecha, t, traidoPor))
        }
      />

      {cambiandoObra && (
        <Hoja titulo={tr("¿En qué obra estás?")} onCerrar={() => setCambiandoObra(false)}>
          {/* Un trabajador puede elegir cualquier obra activa de la empresa (FIC-32); no crea obras. */}
          <SelectorObra
            obras={obras}
            obraId={obraId}
            puedeCrear={false}
            onElegir={(id) => {
              setObraId(id);
              setCambiandoObra(false);
            }}
            onCrear={async () => null}
          />
        </Hoja>
      )}
    </>
  );
}
