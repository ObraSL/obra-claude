import type { Gasto } from "@/lib/types";
import { fmtDate } from "@/lib/format";

/**
 * Cómo se llama un gasto en las listas. Antes era el "concepto", que había
 * que inventarse cada vez; ahora lo que dice qué es el gasto es el
 * proveedor (o la categoría, si no hay), y el concepto es una nota.
 */
export function tituloGasto(g: Pick<Gasto, "proveedor" | "concepto" | "categoria">): string {
  return g.proveedor?.trim() || g.concepto?.trim() || g.categoria;
}

/** La línea pequeña de debajo: la nota (si no es ya el título), la categoría y la fecha. */
export function detalleGasto(
  g: Pick<Gasto, "proveedor" | "concepto" | "categoria" | "fecha">
): string {
  const titulo = tituloGasto(g);
  const partes: string[] = [];
  const nota = g.concepto?.trim();
  // Las facturas pasadas de la lista vieja traen el proveedor repetido como concepto
  if (nota && nota !== titulo && nota !== "Factura") partes.push(nota);
  if (g.categoria !== titulo) partes.push(g.categoria);
  partes.push(fmtDate(g.fecha));
  return partes.join(" · ");
}
