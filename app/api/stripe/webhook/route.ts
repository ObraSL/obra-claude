import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { adminDb, codigoDePago, getStripe, pagadoHasta } from "@/lib/pagos";

/**
 * Stripe llama aquí cada vez que pasa algo con un pago o una suscripción.
 * La firma se comprueba con STRIPE_WEBHOOK_SECRET: sin ella, cualquiera
 * podría "avisar" de pagos falsos.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secreto) return new NextResponse("no configurado", { status: 503 });

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") ?? "",
      secreto
    );
  } catch {
    return new NextResponse("firma no válida", { status: 400 });
  }

  switch (evento.type) {
    case "checkout.session.completed":
      await codigoDePago(stripe, evento.data.object.id);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = evento.data.object;
      const { error } = await adminDb().rpc("actualizar_pago_suscripcion", {
        p_subscription: sub.id,
        p_pagado_hasta: pagadoHasta(sub),
      });
      if (error) return new NextResponse("error de base de datos", { status: 500 });
      break;
    }
  }
  return NextResponse.json({ recibido: true });
}
