"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  BUCKET_FACTURAS,
  actualizarGasto,
  borrarArchivos,
  borrarGasto,
  crearGasto,
  crearProveedor,
  gastosDeObra,
  marcarProveedorFavorito,
  proveedores as listarProveedores,
  rutaGasto,
  subirArchivo,
  urlFirmada,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Gasto, Proveedor } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaGastos, type Quien } from "./VistaGastos";
import { HojaGasto, type ResultadoGuardar, type ValoresGasto } from "./HojaGasto";
import { HojaDetalleGasto } from "./HojaDetalleGasto";
import { buscarProveedor } from "./SelectorProveedor";

/** Mensaje de una escritura fallida: el del servidor, o «sin conexión». */
const mensajeEscritura = (err: { message: string } | null): string | null => {
  if (!err) return null;
  return esFalloDeRed(err) ? tr("Sin conexión. Inténtalo otra vez cuando vuelva la señal.") : err.message;
};

/**
 * Contenedor de «Gastos» (GAS-01…GAS-08): datos, permisos y escrituras. Todos
 * los gastos de la obra —tickets del día a día y facturas— en el mismo sitio.
 */
export function Gastos() {
  const db = useDb();
  const { obraActual, obras } = useObra();
  const { esDueno } = useMiembro();
  const obraActualId = obraActual?.id ?? null;

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorDetalle, setErrorDetalle] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [adding, setAdding] = useState(false);
  const [viendo, setViendo] = useState<Gasto | null>(null);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [quien, setQuien] = useState<Quien>("todo");
  const [mes, setMes] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!obraActualId) return;
    const [g, p] = await Promise.all([gastosDeObra(db, obraActualId), listarProveedores(db)]);
    setCargando(false);
    const fallo = g.error ?? p.error;
    if (fallo) {
      // Se dejan los datos anteriores en pantalla; el fallo se enseña (DIS-13).
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar los gastos.") : fallo.message);
    } else {
      setError("");
    }
    if (!g.error) setGastos(g.data ?? []);
    if (!p.error) setProveedores(p.data ?? []);
  }, [db, obraActualId]);

  const cargarProveedores = useCallback(async () => {
    const { data } = await listarProveedores(db);
    if (data) setProveedores(data);
  }, [db]);

  useEffect(() => {
    setCargando(true);
    void cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  /**
   * Deja el proveedor en la lista (si no estaba) y devuelve su nombre tal
   * como está guardado, para no acabar con «leroy merlin» y «Leroy Merlin».
   */
  const asegurarProveedor = async (
    nombre: string,
    favorito?: boolean
  ): Promise<{ nombre: string | null; error: string | null }> => {
    const limpio = nombre.trim();
    if (!limpio) return { nombre: null, error: null };
    const existente = buscarProveedor(proveedores, limpio);
    if (existente) {
      if (favorito !== undefined && existente.favorito !== favorito) {
        const { error: err } = await marcarProveedorFavorito(db, existente.id, favorito);
        await cargarProveedores();
        return { nombre: existente.nombre, error: mensajeEscritura(err) };
      }
      return { nombre: existente.nombre, error: null };
    }
    const { error: err } = await crearProveedor(db, limpio, favorito ?? false);
    await cargarProveedores();
    return { nombre: limpio, error: mensajeEscritura(err) };
  };

  /** Alta y cambio (GAS-05). Devuelve el error (para la hoja) o el gasto guardado. */
  const guardar = async (v: ValoresGasto, gasto?: Gasto): Promise<ResultadoGuardar> => {
    setError("");
    let recibo_path = gasto?.recibo_path ?? null;
    let recibo_tipo = gasto?.recibo_tipo ?? null;
    let subido: string | null = null;

    if (v.archivo) {
      const ext = v.archivo.type === "application/pdf" ? "pdf" : "jpg";
      const path = rutaGasto(v.obraId, ext);
      const { error: errSubida } = await subirArchivo(db, BUCKET_FACTURAS, path, v.archivo.blob, v.archivo.type);
      if (errSubida) {
        return { error: tr("No se pudo subir el archivo ({detalle}).", { detalle: errSubida.message }) };
      }
      subido = path;
      recibo_path = path;
      recibo_tipo = v.archivo.type;
    }

    // v1 guardaba el gasto aunque el proveedor no se pudiera apuntar: se
    // mantiene, pero el fallo se enseña en la pantalla (no en silencio).
    const prov = await asegurarProveedor(v.proveedor);
    if (prov.error) setError(prov.error);

    const datos = {
      obra_id: v.obraId,
      concepto: v.concepto,
      proveedor: prov.nombre,
      importe: v.importe,
      categoria: v.categoria,
      fecha: v.fecha,
      recibo_path,
      recibo_tipo,
      pagado_por: esDueno ? v.pagadoPor : (gasto?.pagado_por ?? "empresa"),
    };

    const { data, error: err } = gasto ? await actualizarGasto(db, gasto.id, datos) : await crearGasto(db, datos);

    if (err || !data) {
      if (subido) await borrarArchivos(db, BUCKET_FACTURAS, [subido]);
      return { error: mensajeEscritura(err) ?? tr("No se pudo guardar el gasto. Inténtalo de nuevo.") };
    }

    // Foto cambiada: la vieja sobra (salvo la de las facturas pasadas, que
    // es la misma que la copia de la lista vieja: nunca se borra).
    if (subido && gasto?.recibo_path && !gasto.factura_origen_id) {
      await borrarArchivos(db, BUCKET_FACTURAS, [gasto.recibo_path]);
    }
    return { gasto: data };
  };

  const eliminar = async (g: Gasto) => {
    setErrorDetalle("");
    setBorrando(true);
    const { error: err } = await borrarGasto(db, g.id);
    setBorrando(false);
    if (err) {
      setErrorDetalle(mensajeEscritura(err) ?? "");
      return;
    }
    // Los que vienen de la lista vieja de facturas comparten el archivo con
    // la copia que se guardó de ella: ese archivo no se toca.
    if (g.recibo_path && !g.factura_origen_id) {
      await borrarArchivos(db, BUCKET_FACTURAS, [g.recibo_path]);
    }
    setGastos((prev) => prev.filter((x) => x.id !== g.id));
    setViendo(null);
  };

  if (!obraActual) return null;

  const hojaProps = {
    obras,
    obraIdInicial: obraActual.id,
    esDueno,
    proveedores,
    onFavorito: (nombre: string, favorito: boolean) => asegurarProveedor(nombre, favorito),
  };

  return (
    <>
      <VistaGastos
        cargando={cargando}
        error={error}
        gastos={gastos}
        quien={quien}
        mes={mes}
        onQuien={setQuien}
        onMes={setMes}
        onAnadir={() => setAdding(true)}
        onAbrir={(g) => {
          setErrorDetalle("");
          setViendo(g);
        }}
      />

      {adding && (
        <HojaGasto
          {...hojaProps}
          onGuardar={(v) => guardar(v)}
          onGuardado={(g) => {
            if (g.obra_id === obraActual.id) setGastos((prev) => [g, ...prev]);
            setAdding(false);
          }}
          onCerrar={() => setAdding(false)}
        />
      )}

      {viendo && !editando && (
        <HojaDetalleGasto
          gasto={viendo}
          // Lo que pagó el dueño solo lo toca el dueño (también lo impide la base de datos).
          puedeTocar={esDueno || viendo.pagado_por !== "personal"}
          error={errorDetalle}
          borrando={borrando}
          cargarUrl={(path) => urlFirmada(db, BUCKET_FACTURAS, path, 600)}
          onEditar={() => setEditando(viendo)}
          onBorrar={() => eliminar(viendo)}
          onCerrar={() => setViendo(null)}
        />
      )}

      {editando && (
        <HojaGasto
          {...hojaProps}
          gasto={editando}
          onGuardar={(v) => guardar(v, editando)}
          onGuardado={(g) => {
            // Si se ha cambiado de obra, desaparece de esta lista
            setGastos((prev) =>
              g.obra_id === obraActual.id ? prev.map((x) => (x.id === g.id ? g : x)) : prev.filter((x) => x.id !== g.id)
            );
            setEditando(null);
            setViendo(g.obra_id === obraActual.id ? g : null);
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}
