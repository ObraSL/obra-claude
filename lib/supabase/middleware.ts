import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/" es pública (muestra una maqueta si no hay sesión, o el panel real si
// la hay — lo decide el propio componente, no el proxy). Ojo: "/" se compara
// por igualdad exacta, no con startsWith, porque si no coincidiría con
// cualquier ruta y dejaría todo sin proteger.
// /alta y sus /api: alta de empresa nueva con pago (todavía sin cuenta).
const PUBLIC_PATHS = ["/login", "/reset-password", "/alta", "/api/alta", "/api/stripe", "/plantilla-plan-obra.xlsx"];
const EXACT_PUBLIC_PATHS = ["/"];
// De estas, solo /login manda de vuelta a "/" si ya hay sesión. /reset-password
// no, porque el enlace de recuperación de Supabase también crea una sesión
// (temporal) y el usuario necesita quedarse en esa página para poner la
// contraseña nueva.
const REDIRECT_IF_AUTHED = ["/login"];

/**
 * Refresca la sesión de Supabase en cada petición y redirige a /login si
 * no hay usuario autenticado y la ruta no es pública. Se usa desde
 * proxy.ts (el "middleware" de Next.js 16 se llama proxy).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath =
    PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p)) ||
    EXACT_PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && REDIRECT_IF_AUTHED.some((p) => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
