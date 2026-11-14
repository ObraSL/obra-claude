/**
 * Genera los iconos PNG de la app (los que se ven al instalarla en el móvil)
 * a partir del emblema en SVG, para que siempre coincidan con el logo.
 *
 * Uso:  node scripts/generar-iconos.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const FONDO = "#1C1A17"; // oscuro, como el emblema original
const MARCA = "#F2851B"; // naranja de la app
const DESTINO = new URL("../public/icons/", import.meta.url);

/** El mismo trazado que components/ui/Logo.tsx */
function svg(size, escala) {
  const lado = 100 / escala; // "lienzo" alrededor del emblema
  const margen = (lado - 100) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-margen} ${-margen} ${lado} ${lado}">
  <rect x="${-margen}" y="${-margen}" width="${lado}" height="${lado}" fill="${FONDO}"/>
  <g fill="none" stroke="${MARCA}" stroke-width="14" stroke-linejoin="miter" stroke-linecap="butt">
    <path d="M14 70 L50 16 L86 70"/>
    <path d="M38 88 L96 88"/>
  </g>
</svg>`;
}

const iconos = [
  { archivo: "icon-192.png", size: 192, escala: 0.72 },
  { archivo: "icon-512.png", size: 512, escala: 0.72 },
  { archivo: "icon-512-maskable.png", size: 512, escala: 0.54 }, // margen de seguridad
  { archivo: "apple-touch-icon.png", size: 180, escala: 0.72 },
];

await mkdir(DESTINO, { recursive: true });

for (const { archivo, size, escala } of iconos) {
  const destino = new URL(archivo, DESTINO);
  await sharp(Buffer.from(svg(size, escala))).png().toFile(destino.pathname.replace(/^\//, ""));
  console.log(`✓ ${archivo} (${size}x${size})`);
}
