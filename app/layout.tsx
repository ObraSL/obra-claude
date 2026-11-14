import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { COOKIE_IDIOMA, esIdioma, idiomaDesde, type Idioma } from "@/lib/i18n";
import { uk } from "@/lib/i18n/uk";
import { en } from "@/lib/i18n/en";
import { IdiomaProvider } from "@/lib/i18n/provider";
import { COLOR_BARRA, COOKIE_TEMA, esTema, type Tema } from "@/lib/tema";
import { TemaProvider } from "@/lib/tema-provider";

// Una sola familia (DECISIONES D-07): variable, con cirílico para el ucraniano.
// next/font la descarga en el build y la sirve desde nuestro dominio (PLT-04).
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

async function idiomaDeLaPeticion(): Promise<Idioma> {
  const guardado = (await cookies()).get(COOKIE_IDIOMA)?.value;
  return esIdioma(guardado) ? guardado : idiomaDesde(((await headers()).get("accept-language") ?? "").split(","));
}

async function temaDeLaPeticion(): Promise<Tema> {
  const guardado = (await cookies()).get(COOKIE_TEMA)?.value;
  return esTema(guardado) ? guardado : "salvia";
}

const DESCRIPCION = "Fichajes, vehículos, gastos y facturas de tus obras, en un solo sitio.";

export async function generateMetadata(): Promise<Metadata> {
  // La descripción también se traduce (en v1 salía siempre en español).
  const idioma = await idiomaDeLaPeticion();
  const descripcion = idioma === "uk" ? (uk[DESCRIPCION] ?? DESCRIPCION) : idioma === "en" ? (en[DESCRIPCION] ?? DESCRIPCION) : DESCRIPCION;
  return {
    title: "Control de Obra",
    description: descripcion,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Control de Obra",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: COLOR_BARRA[await temaDeLaPeticion()],
    width: "device-width",
    initialScale: 1,
    // iPhone instalado: sin "cover" la barra de estado tapa la parte de
    // arriba. Las zonas seguras se respetan con env(safe-area-inset-*).
    viewportFit: "cover",
  };
}

// Toda la app depende de la sesión y de datos en vivo: nada de HTML
// estático en el build (y el build fallaría sin las variables de Supabase).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const idioma = await idiomaDeLaPeticion();
  const tema = await temaDeLaPeticion();

  return (
    <html
      lang={idioma}
      data-tema={tema === "claro" ? "claro" : undefined}
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-fondo text-tinta">
        <ServiceWorkerRegister />
        <TemaProvider inicial={tema}>
          <IdiomaProvider inicial={idioma}>{children}</IdiomaProvider>
        </TemaProvider>
      </body>
    </html>
  );
}
