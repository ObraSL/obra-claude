import { NextResponse, type NextRequest } from "next/server";
import { getStripe, pagosConfigurados } from "@/lib/pagos";

/** Precio que se enseña en /alta, o que el pago aún no está disponible. */
export async function GET() {
  const stripe = getStripe();
  if (!stripe || !pagosConfigurados()) return NextResponse.json({ disponible: false });
  const precio = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!);
  return NextResponse.json({
    disponible: true,
    importe: (precio.unit_amount ?? 0) / 100,
    moneda: precio.currency,
    intervalo: precio.recurring?.interval ?? "month",
  });
}

/** Abre la página de pago de Stripe: suscripción mensual con 14 días de prueba. */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !pagosConfigurados()) {
    return NextResponse.json({ error: "El pago con tarjeta todavía no está disponible." }, { status: 503 });
  }
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    customer_email: email?.trim() || undefined,
    subscription_data: { trial_period_days: 14 },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    locale: "es",
    success_url: `${origin}/alta/ok?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/alta`,
  });
  return NextResponse.json({ url: session.url });
}
