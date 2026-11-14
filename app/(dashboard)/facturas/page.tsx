import { redirect } from "next/navigation";

/**
 * Las facturas ya no son una lista aparte: van con los gastos (ticket o
 * factura, todo en el mismo sitio), y las que había se pasaron allí. Esta
 * dirección se queda solo para quien la tenga guardada en el móvil.
 */
export default function FacturasPage() {
  redirect("/gastos");
}
