import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Capa de datos (DECISIONES D-08).
 *
 *   pantallas (contenedores) ──► lib/datos/consultas/*  ──► Db
 *                                 (la consulta exacta de v1,         ├─ Supabase real (lib/supabase/client)
 *                                  escrita una sola vez)             └─ motor en memoria (lib/datos/memoria)
 *
 * `Db` es la API de supabase-js que usa la app. Los módulos dorados
 * (offline-fichajes, eliminar-obra) reciben este mismo objeto, por eso el
 * motor en memoria imita esa API en vez de inventar otra.
 */
export type Db = SupabaseClient;

/** Error tal como lo devuelve supabase-js (el mensaje se enseña tal cual, E-2). */
export type ErrorDb = { message: string; code?: string; details?: string | null; hint?: string | null };

/** Respuesta de una consulta: datos o error, nunca una excepción. */
export type Respuesta<T> = { data: T | null; error: ErrorDb | null; count?: number | null };

/** Convierte la respuesta sin tipos de supabase-js en una Respuesta tipada. */
export async function r<T>(consulta: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>): Promise<Respuesta<T>> {
  try {
    const { data, error, count } = await consulta;
    return { data: (data ?? null) as T | null, error: (error ?? null) as ErrorDb | null, count: count ?? null };
  } catch (e) {
    // supabase-js no lanza en errores de red, pero un fetch roto sí puede.
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/** Modo demo: toda la app sin base de datos (D-09). Se decide al compilar. */
export const MODO_MEMORIA = process.env.NEXT_PUBLIC_DATOS === "memoria";
