"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  BUCKET_FACTURAS,
  fichajesDeObraEnMes,
  fichajesDeTrabajadorEnMes,
  gastosDeObraEnMes,
  historialDeObraEnMes,
  trabajadoresTodos,
  urlFirmada,
  usosDeVehiculoEnMes,
  usosVehiculoDeObraEnMes,
  vehiculosTodos,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import type { Fichaje, FichajeHistorial, Gasto, Trabajador, UsoVehiculo, Vehiculo } from "@/lib/types";
import { CATEGORIAS_GASTO } from "@/lib/types";
import { currentMonth, monthLabel } from "@/lib/format";
import { totalesFichajes } from "@/lib/horas";
import { pagadoPorMi, suma } from "@/lib/dinero";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaResumen, type FilaCategoriaMes, type SeccionResumen } from "./VistaResumen";
import { HojaMesTrabajador } from "./HojaMesTrabajador";
import { HojaMesVehiculo } from "./HojaMesVehiculo";
import { HojaCategoriaGastos } from "./HojaCategoriaGastos";

type Detalle =
  | { tipo: "trabajador"; t: Trabajador; registros: Fichaje[] | null; error: string }
  | { tipo: "vehiculo"; v: Vehiculo; registros: UsoVehiculo[] | null; error: string }
  | { tipo: "categoria"; categoria: string }
  | null;

/** Contenedor de Resumen (RES-01…RES-05): el mes de la obra y su exportación a Excel. */
export function Resumen() {
  const db = useDb();
  const { obraActual, obras, jornadaHoras } = useObra();
  const obraId = obraActual?.id ?? null;

  const [mes, setMes] = useState(currentMonth());
  const [seccion, setSeccion] = useState<SeccionResumen>("trabajadores");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [fichajesMes, setFichajesMes] = useState<Fichaje[]>([]);
  const [usosMes, setUsosMes] = useState<UsoVehiculo[]>([]);
  const [gastosMes, setGastosMes] = useState<Gasto[]>([]);
  const [historialMes, setHistorialMes] = useState<FichajeHistorial[]>([]);
  const [detalle, setDetalle] = useState<Detalle>(null);

  const cargar = useCallback(async () => {
    if (!obraId) return;
    const [t, v, f, u, g, h] = await Promise.all([
      trabajadoresTodos(db),
      vehiculosTodos(db),
      fichajesDeObraEnMes(db, obraId, mes),
      usosVehiculoDeObraEnMes(db, obraId, mes),
      gastosDeObraEnMes(db, obraId, mes),
      historialDeObraEnMes(db, obraId, mes),
    ]);
    setCargando(false);
    const fallo = t.error ?? v.error ?? f.error ?? u.error ?? g.error ?? h.error;
    if (fallo) {
      // v1 enseñaba listas vacías sin decir nada (DIS-13).
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar los datos.") : fallo.message);
      return;
    }
    setError("");
    setTrabajadores(t.data ?? []);
    setVehiculos(v.data ?? []);
    setFichajesMes(f.data ?? []);
    setUsosMes(u.data ?? []);
    setGastosMes(g.data ?? []);
    setHistorialMes(h.data ?? []);
  }, [db, obraId, mes]);

  useEffect(() => {
    setCargando(true);
    void cargar();
  }, [cargar]);

  useEnRefresco(cargar);

  /**
   * Exportar a Excel con lo que ya está en pantalla (RES-02). La librería de
   * hojas de cálculo pesa ~1 MB: se carga solo al tocar el botón (T-36; v1 la
   * importaba de entrada en esta pantalla). El archivo sale en español.
   */
  const exportar = async () => {
    if (!obraActual) return;
    setExportando(true);
    try {
      const { exportarResumenObra } = await import("@/lib/exportar-excel");
      exportarResumenObra({
        nombreObra: obraActual.nombre,
        mesLabel: monthLabel(mes),
        fichajes: fichajesMes,
        trabajadores,
        gastos: gastosMes,
        usosVehiculo: usosMes,
        vehiculos,
        jornadaHoras,
        historial: historialMes,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

  const abrirTrabajador = async (t: Trabajador) => {
    setDetalle({ tipo: "trabajador", t, registros: null, error: "" });
    const { data, error: err } = await fichajesDeTrabajadorEnMes(db, t.id, mes);
    setDetalle((d) =>
      d?.tipo === "trabajador" && d.t.id === t.id
        ? { ...d, registros: err ? [] : data ?? [], error: err ? err.message : "" }
        : d
    );
  };

  const abrirVehiculo = async (v: Vehiculo) => {
    setDetalle({ tipo: "vehiculo", v, registros: null, error: "" });
    const { data, error: err } = await usosDeVehiculoEnMes(db, v.id, mes);
    setDetalle((d) =>
      d?.tipo === "vehiculo" && d.v.id === v.id ? { ...d, registros: err ? [] : data ?? [], error: err ? err.message : "" } : d
    );
  };

  if (!obraActual) return null;

  // Trabajadores: uno por fila con sus días del mes en ESTA obra. Los dados de
  // baja sin nada este mes no se listan (DIS-50); si tienen horas, sí: son reales.
  const filasTrabajadores = trabajadores
    .map((t) => {
      const regs = fichajesMes.filter((f) => f.trabajador_id === t.id && f.hora_entrada);
      const { trabajados, extra, sinCerrar } = totalesFichajes(regs, jornadaHoras);
      return { id: t.id, nombre: t.nombre, activo: t.activo, dias: regs.length, trabajados, extra, sinCerrar };
    })
    .filter((f) => f.activo || f.dias > 0)
    .sort((a, b) => b.dias - a.dias);

  const filasVehiculos = vehiculos
    .map((v) => ({
      id: v.id,
      nombre: v.nombre,
      activo: v.activo,
      dias: new Set(usosMes.filter((u) => u.vehiculo_id === v.id).map((u) => u.fecha)).size,
    }))
    .filter((f) => f.activo || f.dias > 0)
    .sort((a, b) => b.dias - a.dias);

  // Gastos: en céntimos (DIS-03). Las categorías antiguas que no están en la
  // lista actual tienen su propia tarjeta, para que las tarjetas sumen el total (DIS-04).
  const totalGastos = suma(gastosMes);
  const categoriasPresentes = [
    ...CATEGORIAS_GASTO,
    ...[...new Set(gastosMes.map((g) => g.categoria))].filter((c) => !(CATEGORIAS_GASTO as readonly string[]).includes(c)),
  ];
  const categorias: FilaCategoriaMes[] = categoriasPresentes
    .map((categoria) => {
      const registros = gastosMes.filter((g) => g.categoria === categoria);
      const fechas = registros.map((g) => g.fecha).sort();
      const total = suma(registros);
      return {
        categoria,
        total,
        n: registros.length,
        desde: fechas[0],
        hasta: fechas[fechas.length - 1],
        pct: totalGastos > 0 ? Math.round((total / totalGastos) * 100) : 0,
      };
    })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.total - a.total);

  const nombreObra = (id: string) => obras.find((o) => o.id === id)?.nombre ?? tr("Otra obra");

  return (
    <>
      <VistaResumen
        mes={mes}
        seccion={seccion}
        cargando={cargando}
        error={error}
        exportando={exportando}
        hayTrabajadores={filasTrabajadores.length > 0}
        hayVehiculos={filasVehiculos.length > 0}
        trabajadores={filasTrabajadores}
        vehiculos={filasVehiculos}
        categorias={categorias}
        totalGastos={totalGastos}
        pagadoPorTi={pagadoPorMi(gastosMes)}
        hayGastos={gastosMes.length > 0}
        onMes={setMes}
        onSeccion={setSeccion}
        onExportar={exportar}
        onAbrirTrabajador={(id) => {
          const t = trabajadores.find((x) => x.id === id);
          if (t) void abrirTrabajador(t);
        }}
        onAbrirVehiculo={(id) => {
          const v = vehiculos.find((x) => x.id === id);
          if (v) void abrirVehiculo(v);
        }}
        onAbrirCategoria={(categoria) => setDetalle({ tipo: "categoria", categoria })}
      />

      {detalle?.tipo === "trabajador" && (
        <HojaMesTrabajador
          nombre={detalle.t.nombre}
          registros={detalle.registros}
          error={detalle.error}
          jornadaHoras={jornadaHoras}
          nombreObra={nombreObra}
          onCerrar={() => setDetalle(null)}
        />
      )}
      {detalle?.tipo === "vehiculo" && (
        <HojaMesVehiculo
          nombre={detalle.v.nombre}
          registros={detalle.registros}
          error={detalle.error}
          nombreObra={nombreObra}
          nombreConductor={(id) => trabajadores.find((t) => t.id === id)?.nombre}
          onCerrar={() => setDetalle(null)}
        />
      )}
      {detalle?.tipo === "categoria" && (
        <HojaCategoriaGastos
          categoria={detalle.categoria}
          registros={gastosMes.filter((g) => g.categoria === detalle.categoria).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))}
          cargarUrl={(path) => urlFirmada(db, BUCKET_FACTURAS, path, 600)}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </>
  );
}
