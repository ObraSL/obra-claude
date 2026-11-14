"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  BUCKET_FACTURAS,
  borrarArchivos,
  borrarCobro,
  borrarEntrega,
  cobrosDeObra,
  crearCobro,
  crearEntrega,
  entregas as listarEntregas,
  gastosDinero,
  gastosPagadosPorMi,
  presupuestosTareas,
  rutaCobro,
  subirArchivo,
  urlFirmada,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Cobro, Entrega, Gasto } from "@/lib/types";
import { balanceObra, miCaja, suma } from "@/lib/dinero";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaDinero, VistaDineroBloqueada } from "./VistaDinero";
import { HojaCobro, type ValoresCobro } from "./HojaCobro";
import { HojaDetalleCobro } from "./HojaDetalleCobro";
import { HojaEntrega, type ValoresEntrega } from "./HojaEntrega";

type GastoCorto = Pick<Gasto, "importe" | "pagado_por" | "obra_id">;

/** Mensaje de una escritura fallida: el del servidor, o «sin conexión». */
const mensajeEscritura = (err: { message: string } | null): string | null => {
  if (!err) return null;
  return esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message;
};

/**
 * Contenedor de «Dinero» (DIN-01…DIN-05). Lo cobrado es el margen de la obra:
 * el jefe de obra no lo ve (tampoco la base de datos se lo daría).
 */
export function Dinero() {
  const { rol } = useMiembro();
  if (rol === "jefe_obra") return <VistaDineroBloqueada />;
  return <DineroDatos />;
}

function DineroDatos() {
  const db = useDb();
  const { obraActual, obras } = useObra();
  const { esDueno, miembro, modulos } = useMiembro();
  // La caja del jefe (Ajustes → Módulos) es solo cosa del dueño.
  const conCaja = esDueno && modulos.caja_jefe;
  const obraActualId = obraActual?.id ?? null;

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] = useState("");
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [gastosObra, setGastosObra] = useState<GastoCorto[]>([]);
  const [presupuesto, setPresupuesto] = useState(0);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [pagadoPorMiTodas, setPagadoPorMiTodas] = useState<GastoCorto[]>([]);
  const [anadiendo, setAnadiendo] = useState<"cobro" | "entrega" | null>(null);
  const [viendoCobro, setViendoCobro] = useState<Cobro | null>(null);
  const [borrandoCobro, setBorrandoCobro] = useState(false);
  const [borrandoEntrega, setBorrandoEntrega] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!obraActualId) return;
    const [c, g, t] = await Promise.all([cobrosDeObra(db, obraActualId), gastosDinero(db, obraActualId), presupuestosTareas(db, obraActualId)]);
    // La caja es de todas las obras juntas: el jefe da el dinero a la
    // persona, no a una obra.
    const [e, p] = esDueno
      ? await Promise.all([listarEntregas(db), gastosPagadosPorMi(db)])
      : [null, null];
    setCargando(false);

    const fallo = c.error ?? g.error ?? t.error ?? e?.error ?? p?.error ?? null;
    if (fallo) {
      // Se dejan los datos anteriores en pantalla; el fallo se enseña (DIS-13).
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar los datos.") : fallo.message);
      return;
    }
    setError("");
    setCobros(c.data ?? []);
    setGastosObra(g.data ?? []);
    setPresupuesto(suma((t.data ?? []).map((x) => ({ importe: x.presupuesto }))));
    if (e && p) {
      setEntregas(e.data ?? []);
      setPagadoPorMiTodas(p.data ?? []);
    }
  }, [db, obraActualId, esDueno]);

  useEffect(() => {
    setCargando(true);
    void cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  /** Pago del cliente (DIN-03): primero el justificante, luego la fila; si la fila falla, el archivo se retira. */
  const guardarCobro = async (v: ValoresCobro): Promise<string | null> => {
    if (!obraActualId) return tr("No hay obra elegida.");
    let archivo_path: string | null = null;
    if (v.archivo) {
      const ext = v.archivo.type === "application/pdf" ? "pdf" : "jpg";
      const path = rutaCobro(obraActualId, ext);
      const { error: errSubida } = await subirArchivo(db, BUCKET_FACTURAS, path, v.archivo.blob, v.archivo.type);
      if (errSubida) return tr("No se pudo subir el archivo ({detalle}).", { detalle: errSubida.message });
      archivo_path = path;
    }
    const { error: err } = await crearCobro(db, {
      obra_id: obraActualId,
      importe: v.importe,
      fecha: v.fecha,
      concepto: v.concepto,
      archivo_path,
      archivo_tipo: v.archivo?.type ?? null,
    });
    if (err) {
      if (archivo_path) await borrarArchivos(db, BUCKET_FACTURAS, [archivo_path]);
      return mensajeEscritura(err);
    }
    setAnadiendo(null);
    await cargar();
    return null;
  };

  /**
   * DIS-24: v1 borraba el archivo primero y no miraba el error; si la base lo
   * rechazaba, el justificante ya estaba perdido. Aquí primero la fila y, solo
   * si salió bien, el archivo; cualquier error se enseña.
   */
  const eliminarCobro = async (c: Cobro) => {
    setErrorDetalle("");
    setBorrandoCobro(true);
    const { error: err } = await borrarCobro(db, c.id);
    if (err) {
      setBorrandoCobro(false);
      setErrorDetalle(mensajeEscritura(err) ?? "");
      return;
    }
    let fallo = "";
    if (c.archivo_path) {
      const { error: errArchivo } = await borrarArchivos(db, BUCKET_FACTURAS, [c.archivo_path]);
      if (errArchivo) fallo = mensajeEscritura(errArchivo) ?? "";
    }
    setBorrandoCobro(false);
    setViendoCobro(null);
    await cargar();
    // `cargar` limpia el error si todo fue bien; el del archivo se vuelve a poner.
    if (fallo) setError(fallo);
  };

  /** Dinero del jefe (DIN-05). */
  const guardarEntrega = async (v: ValoresEntrega): Promise<string | null> => {
    if (!miembro) return tr("No se pudo guardar. Inténtalo otra vez.");
    const { error: err } = await crearEntrega(db, miembro.user_id, {
      importe: v.importe,
      fecha: v.fecha,
      concepto: v.concepto,
      obra_id: v.obraId,
    });
    if (err) return mensajeEscritura(err);
    setAnadiendo(null);
    await cargar();
    return null;
  };

  const eliminarEntrega = async (e: Entrega) => {
    setError("");
    setBorrandoEntrega(e.id);
    const { error: err } = await borrarEntrega(db, e.id);
    setBorrandoEntrega(null);
    if (err) {
      setError(mensajeEscritura(err) ?? "");
      return;
    }
    await cargar();
  };

  if (!obraActual) return null;

  const obra = balanceObra(cobros, gastosObra);
  const caja = miCaja(entregas, pagadoPorMiTodas);
  // Dinero del jefe apuntado a esta obra en concreto: cuenta como dinero
  // disponible de la obra (junto al cliente), igual que lo dice el saldo.
  // Q-01 (pregunta abierta): con el módulo APAGADO el dueño sigue sumándolo
  // al saldo, igual que v1; no se «arregla».
  const recibidoObra = esDueno ? suma(entregas.filter((e) => e.obra_id === obraActual.id)) : 0;
  const balanceTotal = Math.round((obra.balance + recibidoObra) * 100) / 100;
  const pctPresupuesto = presupuesto > 0 ? Math.round((obra.gastado / presupuesto) * 100) : 0;

  // Lo pagado por mí, obra por obra: para saber de dónde sale el total
  const pagadoPorObra = obras
    .map((o) => ({ nombre: o.nombre, total: suma(pagadoPorMiTodas.filter((g) => g.obra_id === o.id)) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <VistaDinero
        cargando={cargando}
        error={error}
        obraNombre={obraActual.nombre}
        obras={obras}
        conCaja={conCaja}
        cobrado={obra.cobrado}
        gastado={obra.gastado}
        recibidoObra={recibidoObra}
        balance={balanceTotal}
        presupuesto={presupuesto}
        pctPresupuesto={pctPresupuesto}
        caja={caja}
        cobros={cobros}
        entregas={entregas}
        pagadoPorObra={pagadoPorObra}
        borrandoEntrega={borrandoEntrega}
        onAnadirCobro={() => setAnadiendo("cobro")}
        onAbrirCobro={(c) => {
          setErrorDetalle("");
          setViendoCobro(c);
        }}
        onAnadirEntrega={() => setAnadiendo("entrega")}
        onBorrarEntrega={eliminarEntrega}
      />

      {anadiendo === "cobro" && <HojaCobro onGuardar={guardarCobro} onCerrar={() => setAnadiendo(null)} />}

      {anadiendo === "entrega" && conCaja && (
        <HojaEntrega obras={obras} onGuardar={guardarEntrega} onCerrar={() => setAnadiendo(null)} />
      )}

      {viendoCobro && (
        <HojaDetalleCobro
          cobro={viendoCobro}
          error={errorDetalle}
          borrando={borrandoCobro}
          cargarUrl={(path) => urlFirmada(db, BUCKET_FACTURAS, path, 600)}
          onBorrar={() => eliminarCobro(viendoCobro)}
          onCerrar={() => setViendoCobro(null)}
        />
      )}
    </>
  );
}
