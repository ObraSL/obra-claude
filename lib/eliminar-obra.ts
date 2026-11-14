import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Borrado definitivo de una obra: primero los archivos del Storage (fotos
 * de recibos, audios — SQL no los toca), luego todo lo demás en una sola
 * función del servidor (transacción, ver eliminar_obra en el esquema).
 * Devuelve un mensaje de error, o null si salió bien.
 */
export async function eliminarObraDefinitivamente(
  supabase: SupabaseClient,
  obraId: string
): Promise<string | null> {
  const [gastos, cobros, notas] = await Promise.all([
    supabase.from("gastos").select("recibo_path").eq("obra_id", obraId).not("recibo_path", "is", null),
    supabase.from("cobros").select("archivo_path").eq("obra_id", obraId).not("archivo_path", "is", null),
    supabase.from("notas_audio").select("audio_path").eq("obra_id", obraId),
  ]);

  const rutasFacturas = [
    ...(gastos.data ?? []).map((g: { recibo_path: string | null }) => g.recibo_path),
    ...(cobros.data ?? []).map((c: { archivo_path: string | null }) => c.archivo_path),
  ].filter((p): p is string => !!p);

  const rutasNotas = (notas.data ?? [])
    .map((n: { audio_path: string | null }) => n.audio_path)
    .filter((p): p is string => !!p);

  if (rutasFacturas.length > 0) {
    await supabase.storage.from("facturas").remove(rutasFacturas);
  }
  if (rutasNotas.length > 0) {
    await supabase.storage.from("notas").remove(rutasNotas);
  }

  const { error } = await supabase.rpc("eliminar_obra", { p_obra_id: obraId });
  return error ? error.message : null;
}
