import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// En Next.js 16 el antiguo "middleware" pasa a llamarse "proxy".
export async function proxy(request: NextRequest) {
  // v2: la galería de diseño y el modo demo usan datos en memoria; no hay
  // sesión de Supabase que refrescar ni proteger (ENTREGA/cambios-en-dorados.md).
  // En producción ninguna de las dos variables existe y esto no cambia nada.
  if (sinSupabase(request.nextUrl.pathname)) return NextResponse.next();
  return await updateSession(request);
}

function sinSupabase(ruta: string) {
  if (process.env.NEXT_PUBLIC_DATOS === "memoria") return true;
  return process.env.NEXT_PUBLIC_GALERIA === "1" && (ruta === "/galeria" || ruta.startsWith("/galeria/"));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
