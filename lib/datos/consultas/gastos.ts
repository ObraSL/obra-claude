import { r, type Db, type Respuesta } from "@/lib/datos/db";
import type { Gasto, PagadoPor, Proveedor } from "@/lib/types";

/** Gastos de una obra, el más reciente primero. Usada en: Gastos. Spec: #62. */
export function gastosDeObra(db: Db, obraId: string): Promise<Respuesta<Gasto[]>> {
  return r<Gasto[]>(
    db.from("gastos").select("*").eq("obra_id", obraId).order("fecha", { ascending: false }).order("created_at", { ascending: false })
  );
}

/** Importes de gastos para el Home del gestor. Usada en: InicioGestor. Spec: #64. */
export function gastosHome(db: Db, obraId: string): Promise<Respuesta<Pick<Gasto, "importe" | "pagado_por" | "fecha">[]>> {
  return r(db.from("gastos").select("importe,pagado_por,fecha").eq("obra_id", obraId));
}

/** Importes de gastos de la obra para el balance. Usada en: Dinero. Spec: #65. */
export function gastosDinero(db: Db, obraId: string): Promise<Respuesta<Pick<Gasto, "importe" | "pagado_por" | "obra_id">[]>> {
  return r(db.from("gastos").select("importe,pagado_por,obra_id").eq("obra_id", obraId));
}

/** Gastos que pagué yo, todas las obras (solo dueño). Usada en: Dinero. Spec: #66. */
export function gastosPagadosPorMi(db: Db): Promise<Respuesta<Pick<Gasto, "importe" | "pagado_por" | "obra_id">[]>> {
  return r(db.from("gastos").select("importe,pagado_por,obra_id").eq("pagado_por", "personal"));
}

/** Campos de un gasto nuevo. */
export type NuevoGasto = {
  obra_id: string;
  concepto: string | null;
  proveedor: string | null;
  importe: number;
  categoria: string;
  fecha: string;
  recibo_path: string | null;
  recibo_tipo: string | null;
  pagado_por: PagadoPor;
};

/** Crea un gasto. Usada en: Gastos. Spec: #67. */
export function crearGasto(db: Db, d: NuevoGasto): Promise<Respuesta<Gasto>> {
  return r<Gasto>(
    db
      .from("gastos")
      .insert({
        obra_id: d.obra_id,
        concepto: d.concepto,
        proveedor: d.proveedor,
        importe: d.importe,
        categoria: d.categoria,
        fecha: d.fecha,
        recibo_path: d.recibo_path,
        recibo_tipo: d.recibo_tipo,
        pagado_por: d.pagado_por,
      })
      .select()
      .single()
  );
}

/** Actualiza un gasto con los campos dados. Usada en: Gastos. Spec: #68. */
export function actualizarGasto(db: Db, id: string, d: Partial<NuevoGasto>): Promise<Respuesta<Gasto>> {
  return r<Gasto>(db.from("gastos").update(d).eq("id", id).select().single());
}

/** Borra un gasto (el archivo se borra después, salvo factura_origen_id). Usada en: Gastos. Spec: #69. */
export function borrarGasto(db: Db, id: string): Promise<Respuesta<unknown>> {
  return r(db.from("gastos").delete().eq("id", id));
}

/** Lista de proveedores. Usada en: Gastos. Spec: #70. */
export function proveedores(db: Db): Promise<Respuesta<Proveedor[]>> {
  return r<Proveedor[]>(db.from("proveedores").select("*").order("nombre"));
}

/** Crea un proveedor. Usada en: Gastos. Spec: #71. */
export function crearProveedor(db: Db, nombre: string, favorito: boolean): Promise<Respuesta<unknown>> {
  return r(db.from("proveedores").insert({ nombre, favorito }));
}

/** Marca o desmarca un proveedor como favorito. Usada en: Gastos. Spec: #72. */
export function marcarProveedorFavorito(db: Db, id: string, favorito: boolean): Promise<Respuesta<unknown>> {
  return r(db.from("proveedores").update({ favorito }).eq("id", id));
}
