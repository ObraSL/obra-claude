/**
 * Partes de la app que cada empresa puede encender o apagar (punto 18).
 * Viven en la fila de "ajustes" de la empresa; si todavía no hay fila,
 * todo está encendido.
 */
export type Modulos = {
  vehiculos: boolean;
  notas_voz: boolean;
  caja_jefe: boolean;
  transporte: boolean;
  geolocalizacion: boolean;
};

export type ClaveModulo = keyof Modulos;

export const MODULOS_POR_DEFECTO: Modulos = {
  vehiculos: true,
  notas_voz: true,
  caja_jefe: true,
  transporte: true,
  geolocalizacion: true,
};

/** Para la pantalla de Ajustes (los textos pasan por tr() al pintarlos). */
export const LISTA_MODULOS: { clave: ClaveModulo; label: string; descripcion: string }[] = [
  { clave: "vehiculos", label: "Vehículos", descripcion: "Quién lleva cada coche y a qué obra." },
  { clave: "notas_voz", label: "Notas de voz", descripcion: "Una nota grabada por día y obra." },
  {
    clave: "caja_jefe",
    label: "Dinero del jefe",
    descripcion: "El dinero que el jefe te da para gastos y sueldos, y lo que te queda.",
  },
  { clave: "transporte", label: "Cómo llegó a la obra", descripcion: "El trabajador apunta si vino en su coche o le trajeron." },
  {
    clave: "geolocalizacion",
    label: "Ubicación al fichar",
    descripcion: "Al fichar se comprueba si el móvil está dentro o fuera de la obra.",
  },
];

/** Qué página depende de qué módulo (para el menú y para no dejar entrar a mano). */
export const RUTA_MODULO: Record<string, ClaveModulo> = {
  "/vehiculos": "vehiculos",
  "/notas": "notas_voz",
};

export const rutaApagada = (pathname: string, modulos: Modulos) =>
  Object.entries(RUTA_MODULO).some(([ruta, clave]) => pathname.startsWith(ruta) && !modulos[clave]);

export function modulosDesdeFila(fila: Record<string, unknown> | null | undefined): Modulos {
  const m = { ...MODULOS_POR_DEFECTO };
  if (!fila) return m;
  for (const clave of Object.keys(m) as ClaveModulo[]) {
    const v = fila[`mod_${clave}`];
    if (typeof v === "boolean") m[clave] = v;
  }
  return m;
}
