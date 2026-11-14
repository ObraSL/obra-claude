import {
  ChartGantt,
  ClipboardList,
  Clock3,
  House,
  Mic,
  ReceiptText,
  Settings,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "@/lib/types";
import { rutaApagada, type Modulos } from "@/lib/modulos";

/**
 * Navegación (SHL-02). Los DATOS y las REGLAS son los de v1 sin cambios
 * (qué ve cada rol, en qué orden, qué se apaga con cada módulo); solo los
 * iconos son de v2. Las etiquetas son claves de tr().
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Barra inferior del móvil para dueño/manager/jefe de obra; en escritorio
// se ven todos en la barra lateral, incluido Inicio y Resumen.
export const NAV_ITEMS: NavItem[] = [
  { href: "/fichajes", label: "Fichajes", icon: Clock3 },
  { href: "/vehiculos", label: "Vehículos", icon: Truck },
  { href: "/gastos", label: "Gastos", icon: ReceiptText },
  { href: "/dinero", label: "Dinero", icon: Wallet },
  { href: "/notas", label: "Notas de voz", icon: Mic },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export const NAV_ITEM_INICIO: NavItem = { href: "/", label: "Inicio", icon: House };
export const NAV_ITEM_RESUMEN: NavItem = { href: "/resumen", label: "Resumen", icon: ClipboardList };
export const NAV_ITEM_AJUSTES: NavItem = { href: "/ajustes", label: "Ajustes", icon: Settings };
// Planificación no va en la barra de abajo del móvil (con un séptimo icono
// no cabía en los iPhone estrechos, T-13): se llega desde Inicio y desde la
// barra lateral en el ordenador.
export const NAV_ITEM_PLANIFICACION: NavItem = {
  href: "/planificacion",
  label: "Planificación",
  icon: ChartGantt,
};

/** El trabajador: la obra, sus horas, los vehículos (sin tocarlos) y su cuenta. */
const NAV_TRABAJADOR: NavItem[] = [
  NAV_ITEM_INICIO,
  { href: "/fichajes", label: "Mis horas", icon: Clock3 },
  { href: "/vehiculos", label: "Vehículos", icon: Truck },
  NAV_ITEM_AJUSTES,
];

/** El jefe de obra no ve «Dinero» (lo que paga el cliente es el margen de la obra). */
const seccionesDe = (rol: Rol | null) =>
  rol === "jefe_obra" ? NAV_ITEMS.filter((i) => i.href !== "/dinero") : NAV_ITEMS;

/** Barra inferior del móvil. */
export function navMovil(rol: Rol | null, modulos: Modulos): NavItem[] {
  return (rol === "trabajador" ? NAV_TRABAJADOR : seccionesDe(rol)).filter((i) => !rutaApagada(i.href, modulos));
}

/** Barra lateral de escritorio: Inicio → Planificación → secciones → Resumen → Ajustes. */
export function navLateral(rol: Rol | null, modulos: Modulos): NavItem[] {
  return navLateralCompleto(rol).filter((i) => !rutaApagada(i.href, modulos));
}

function navLateralCompleto(rol: Rol | null): NavItem[] {
  if (rol === "trabajador") return NAV_TRABAJADOR;
  const secciones = seccionesDe(rol).filter((i) => i.href !== "/ajustes");
  return [NAV_ITEM_INICIO, NAV_ITEM_PLANIFICACION, ...secciones, NAV_ITEM_RESUMEN, NAV_ITEM_AJUSTES];
}

/** Páginas que un trabajador no puede abrir (aunque escriba la dirección a mano). */
export const RUTAS_SOLO_GESTORES = ["/gastos", "/facturas", "/notas", "/resumen", "/planificacion", "/dinero"];

/** ¿La ruta está activa? "/" solo por igualdad exacta (como en el proxy, T-17). */
export const rutaActiva = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Orden «de lectura» de las pantallas, el mismo de la barra lateral:
 * Inicio → Planificación → secciones → Resumen → Ajustes. Sirve para decidir
 * hacia dónde se desliza una pantalla al navegar: hacia un destino posterior
 * entra por la derecha («adelante»); hacia uno anterior, por la izquierda
 * («atras»). Es solo animación: no cambia qué ve cada rol (eso lo decide nav).
 */
const ORDEN_PANTALLAS = ["/", "/planificacion", "/fichajes", "/vehiculos", "/gastos", "/dinero", "/notas", "/resumen", "/ajustes"];
const rangoPantalla = (ruta: string) => ORDEN_PANTALLAS.findIndex((r) => rutaActiva(r, ruta));

/** Tipo de transición (`transitionTypes` de <Link>) para ir de `desde` a `hacia`. */
export function tipoSalto(desde: string, hacia: string): ("adelante" | "atras")[] {
  const a = rangoPantalla(desde);
  const b = rangoPantalla(hacia);
  if (a < 0 || b < 0 || a === b) return [];
  return [b > a ? "adelante" : "atras"];
}

/** Desde Inicio, todo es «adelante» (tarjetas y atajos que bajan a otra pantalla). */
export const TIPO_ADELANTE: ("adelante" | "atras")[] = ["adelante"];

