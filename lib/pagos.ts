import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Solo para el servidor (rutas de app/api): usa claves secretas que nunca
// deben llegar al navegador. Si faltan en el entorno, el pago queda
// "no disponible" en vez de romper nada.

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export function pagosConfigurados() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Cliente de Supabase con permisos de servidor (salta RLS). */
export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Días de margen tras el fin del periodo, mientras Stripe reintenta cobrar. */
const DIAS_MARGEN = 3;

/**
 * Hasta cuándo tiene acceso una empresa según su suscripción: fin del
 * periodo pagado (o de la prueba) más unos días de margen. Si la
 * suscripción está cancelada o impagada del todo, desde ya.
 */
export function pagadoHasta(sub: Stripe.Subscription): string {
  if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
    return new Date().toISOString();
  }
  const fines = sub.items.data.map((i) => i.current_period_end);
  if (sub.trial_end) fines.push(sub.trial_end);
  const fin = Math.max(...fines, Math.floor(Date.now() / 1000));
  return new Date((fin + DIAS_MARGEN * 86_400) * 1000).toISOString();
}

/** Apunta un pago terminado y devuelve su código de alta (siempre el mismo para ese pago). */
export async function codigoDePago(stripe: Stripe, sessionId: string): Promise<string | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.status !== "complete" || !session.subscription) return null;
  const sub = session.subscription as Stripe.Subscription;
  const { data, error } = await adminDb().rpc("registrar_pago_alta", {
    p_session: session.id,
    p_email: session.customer_details?.email ?? session.customer_email ?? null,
    p_customer: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    p_subscription: sub.id,
    p_pagado_hasta: pagadoHasta(sub),
  });
  if (error) throw error;
  return data as string;
}
