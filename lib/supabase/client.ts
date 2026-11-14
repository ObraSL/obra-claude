import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar en componentes cliente ("use client").
 * Cada módulo que lo importe comparte la misma instancia (Supabase la
 * cachea internamente), así que se puede llamar sin preocuparse por crear
 * conexiones de más.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
