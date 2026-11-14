import { notFound } from "next/navigation";

/**
 * Galería de diseño (MASTER-PROMPT §6): sin login, con datos en memoria.
 * Solo existe con NEXT_PUBLIC_GALERIA=1; en producción esa variable no se
 * define y todo /galeria devuelve 404.
 */
export default function GaleriaLayout({ children }: LayoutProps<"/galeria">) {
  if (process.env.NEXT_PUBLIC_GALERIA !== "1") notFound();
  return children;
}
