"use client";

import clsx from "clsx";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { tr } from "@/lib/i18n";
import { rutaActiva, type NavItem } from "@/lib/nav";
import { Logo } from "@/components/marca/Logo";

/**
 * Barra inferior del móvil: la cápsula flotante translúcida de la
 * referencia, con el destino activo en una tesela honda.
 * - 6 destinos (gestores): solo icono + aria-label; la página lo dice en su h1.
 * - 4 destinos (trabajador): icono y palabra (más claro para quien ficha).
 * Cabe en 320 px: 6 × 44 px + huecos = 288 px (T-13). Respeta la zona segura.
 */
export function BarraInferior({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const conTexto = items.length <= 4;
  return (
    <nav
      aria-label={tr("Navegación principal")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
    >
      <ul
        className={clsx(
          "vidrio pointer-events-auto mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[16px] p-1.5"
        )}
      >
        {items.map((item) => {
          const activo = rutaActiva(item.href, pathname);
          const Icono = item.icon;
          const etiqueta = tr(item.label);
          return (
            // Con texto, cada destino mide lo que mide su palabra (no partes
            // iguales): «Налаштування» es ×1,7 más largo que «Ajustes» (T-39)
            // y así cabe entero a 320 px, sin truncar ni partir.
            <li key={item.href} className={clsx("flex min-w-0 justify-center", conTexto ? "flex-auto" : "flex-1")}>
              <Link
                href={item.href}
                aria-label={conTexto ? undefined : etiqueta}
                aria-current={activo ? "page" : undefined}
                className={clsx(
                  "flex min-h-12 w-full min-w-11 flex-col items-center justify-center gap-0.5 rounded-[11px] px-1 transition-colors",
                  activo ? "bg-sup-honda text-sobre-honda" : "text-tinta hover:bg-white/10"
                )}
              >
                <Icono size={22} strokeWidth={1.8} aria-hidden />
                {conTexto && (
                  <span className="whitespace-nowrap text-center text-[0.65625rem] font-medium leading-[1.15] tracking-[-0.01em]">
                    {etiqueta}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra lateral fija del ordenador (≥ 768 px): marca, navegación y salir (SHL-01, ACC-14). */
export function BarraLateral({
  items,
  pathname,
  onSalir,
}: {
  items: NavItem[];
  pathname: string;
  onSalir: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col bg-sup-honda px-4 py-6 text-sobre-honda md:flex">
      <Link href="/" className="mb-8 inline-flex min-h-11 items-center rounded-boton px-2" aria-label={tr("Inicio")}>
        <span className="[&_span]:text-sobre-honda">
          <Logo />
        </span>
      </Link>
      <nav aria-label={tr("Navegación principal")} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="grid gap-1">
          {items.map((item) => {
            const activo = rutaActiva(item.href, pathname);
            const Icono = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={activo ? "page" : undefined}
                  className={clsx(
                    "flex min-h-11 items-center gap-3 rounded-boton px-3 text-base transition-colors",
                    activo ? "bg-lima font-medium text-sobre-lima" : "hover:bg-white/10"
                  )}
                >
                  <Icono size={20} strokeWidth={1.8} aria-hidden />
                  <span className="min-w-0 truncate">{tr(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={onSalir}
        className="mt-4 flex min-h-11 items-center gap-3 rounded-boton px-3 text-base hover:bg-white/10"
      >
        <LogOut size={20} strokeWidth={1.8} aria-hidden />
        {tr("Cerrar sesión")}
      </button>
    </aside>
  );
}
