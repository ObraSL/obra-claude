import * as XLSX from "xlsx";
import type { Fichaje, FichajeHistorial, Gasto, Trabajador, UsoVehiculo, Vehiculo } from "@/lib/types";
import { fmtHoras, minutosExtra, minutosTrabajados } from "@/lib/horas";

/**
 * Punto 12 del plan: exportar a Excel lo del mes de una obra, para
 * enseñárselo a alguien o guardarlo aparte. Cada pestaña es una tabla
 * normal — se abre igual en el Excel del gestor o en Google Sheets.
 */
export function exportarResumenObra({
  nombreObra,
  mesLabel,
  fichajes,
  trabajadores,
  gastos,
  usosVehiculo,
  vehiculos,
  jornadaHoras,
  historial,
}: {
  nombreObra: string;
  mesLabel: string;
  fichajes: Fichaje[];
  trabajadores: Trabajador[];
  gastos: Gasto[];
  usosVehiculo: UsoVehiculo[];
  vehiculos: Vehiculo[];
  jornadaHoras: number;
  historial: FichajeHistorial[];
}) {
  const nombreTrabajador = (id: string) => trabajadores.find((t) => t.id === id)?.nombre ?? "—";
  const nombreVehiculo = (id: string) => vehiculos.find((v) => v.id === id)?.nombre ?? "—";

  const wb = XLSX.utils.book_new();

  const filasHoras = fichajes
    .filter((f) => f.hora_entrada)
    .map((f) => {
      const min = minutosTrabajados(f.hora_entrada, f.hora_salida);
      const extra = minutosExtra(min, jornadaHoras);
      return {
        Trabajador: nombreTrabajador(f.trabajador_id),
        Fecha: f.fecha,
        Entrada: f.hora_entrada ?? "",
        Salida: f.hora_salida ?? "",
        Horas: min !== null ? fmtHoras(min) : "",
        "Horas extra": extra > 0 ? fmtHoras(extra) : "",
        "Corregido por el dueño": f.hora_corregida ? "Sí" : "No",
        Confirmado: f.hora_corregida ? (f.confirmado_trabajador ? "Sí" : "No") : "",
        "Fuera de la obra": f.ubicacion_ok === false ? `Sí (${f.distancia_metros ?? "?"} m)` : "",
      };
    })
    .sort((a, b) => (a.Fecha === b.Fecha ? a.Trabajador.localeCompare(b.Trabajador) : a.Fecha < b.Fecha ? -1 : 1));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasHoras), "Horas");

  const filasGastos = gastos
    .map((g) => ({
      Fecha: g.fecha,
      Proveedor: g.proveedor ?? "",
      Categoría: g.categoria,
      "Importe (€)": Number(g.importe),
      "Pagado por": g.pagado_por === "personal" ? "El dueño" : "La empresa",
      Nota: g.concepto ?? "",
      "Tiene foto": g.recibo_path ? "Sí" : "No",
    }))
    .sort((a, b) => (a.Fecha < b.Fecha ? -1 : 1));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasGastos), "Gastos");

  if (usosVehiculo.length > 0) {
    const filasVehiculos = usosVehiculo
      .map((u) => ({
        Fecha: u.fecha,
        Vehículo: nombreVehiculo(u.vehiculo_id),
        Conductor: u.conductor_id ? nombreTrabajador(u.conductor_id) : "",
        Destino: u.destino ?? "",
      }))
      .sort((a, b) => (a.Fecha < b.Fecha ? -1 : 1));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasVehiculos), "Vehículos");
  }

  if (historial.length > 0) {
    const filasHistorial = historial
      .map((h) => ({
        Fecha: h.fecha,
        Trabajador: nombreTrabajador(h.trabajador_id),
        "Entrada antes": h.hora_entrada_antes ?? "",
        "Entrada después": h.hora_entrada_despues ?? "",
        "Salida antes": h.hora_salida_antes ?? "",
        "Salida después": h.hora_salida_despues ?? "",
        "Cambiado el": new Date(h.cambiado_en).toLocaleString("es-ES"),
      }))
      .sort((a, b) => (a.Fecha < b.Fecha ? -1 : 1));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasHistorial), "Correcciones");
  }

  const nombreArchivo = `${nombreObra} - ${mesLabel}.xlsx`.replace(/[\\/:*?"<>|]/g, "");
  XLSX.writeFile(wb, nombreArchivo);
}
