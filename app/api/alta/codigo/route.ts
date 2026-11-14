import { NextResponse, type NextRequest } from "next/server";
import { codigoDePago, getStripe, pagosConfigurados } from "@/lib/pagos";

/** Tras volver de Stripe: el código de alta de ese pago (se crea la primera vez). */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const stripe = getStripe();
  if (!stripe || !pagosConfigurados() || !sessionId) {
    return NextResponse.json({ error: "Falta información del pago." }, { status: 400 });
  }
  try {
    const codigo = await codigoDePago(stripe, sessionId);
    if (!codigo) return NextResponse.json({ error: "El pago todavía no está completado." }, { status: 409 });
    return NextResponse.json({ codigo });
  } catch {
    return NextResponse.json({ error: "No se pudo comprobar el pago." }, { status: 500 });
  }
}
