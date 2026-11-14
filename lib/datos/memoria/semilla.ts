/**
 * Datos de ejemplo SINTÉTICOS para el almacén en memoria: nombres inventados,
 * correos `*.invalid` e importes falsos. Nada de datos reales.
 * Todas las fechas son relativas a `hoy`, así la demo siempre parece actual.
 */
import {
  almacenVacio,
  diaSemana,
  instante,
  madrid,
  rellenarFila,
  sumarDias,
  type Almacen,
  type Escenario,
  type Fila,
  type Tabla,
} from "./almacen";

/** Contraseña (falsa, solo para pruebas locales) de TODAS las cuentas sembradas. */
export const CONTRASENA_DEMO = "demo-obra-2026";

export type CuentaDemo = {
  /** "dueno" | "manager" | "jefe_obra" | "trabajador" | "pendiente" | "admin" | "soporte" */
  rol: string;
  etiqueta: string;
  email: string;
  empresa: string;
  descripcion: string;
};

export const CUENTAS_DEMO: CuentaDemo[] = [
  { rol: "dueno", etiqueta: "Dueña · Reformas Salvia", email: "marta.salvia@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Acceso total, corrige horas, dinero y ajustes." },
  { rol: "manager", etiqueta: "Manager · Reformas Salvia", email: "luis.ortega@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Ve y gestiona todas las obras; no toca lo del dueño." },
  { rol: "jefe_obra", etiqueta: "Jefa de obra · Reformas Salvia", email: "raquel.vidal@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Solo su obra asignada (Calle Olmo)." },
  { rol: "trabajador", etiqueta: "Trabajador · Reformas Salvia", email: "diego.navarro@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Ficha sus horas; ya aceptó el aviso de control." },
  { rol: "trabajador", etiqueta: "Trabajadora sin aviso · Reformas Salvia", email: "irene.campos@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Todavía no ha aceptado el aviso de control." },
  { rol: "pendiente", etiqueta: "Cuenta pendiente · Reformas Salvia", email: "pablo.reyes@reformas-salvia.invalid", empresa: "Reformas Salvia", descripcion: "Registrada con el código de la empresa; falta que el dueño la apruebe." },
  { rol: "dueno", etiqueta: "Dueña · Construcciones Ejemplo", email: "ana.ejemplo@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Otra empresa: sirve para comprobar el aislamiento." },
  { rol: "manager", etiqueta: "Manager · Construcciones Ejemplo", email: "javier.cano@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Manager de la otra empresa." },
  { rol: "jefe_obra", etiqueta: "Jefa de obra · Construcciones Ejemplo", email: "sara.pons@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Jefa de la nave del polígono." },
  { rol: "trabajador", etiqueta: "Trabajador · Construcciones Ejemplo", email: "ivan.soto@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Trabajador de la otra empresa." },
  { rol: "trabajador", etiqueta: "Trabajadora sin aviso · Construcciones Ejemplo", email: "nerea.lara@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Sin aviso de control aceptado." },
  { rol: "pendiente", etiqueta: "Cuenta pendiente · Construcciones Ejemplo", email: "oscar.gil@construcciones-ejemplo.invalid", empresa: "Construcciones Ejemplo", descripcion: "Pendiente de aprobación." },
  { rol: "dueno", etiqueta: "Dueña · Carpintería Roble (suscripción caducada)", email: "gloria.roble@carpinteria-roble.invalid", empresa: "Carpintería Roble", descripcion: "Empresa con la suscripción caducada: ve la pantalla de renovar." },
  { rol: "admin", etiqueta: "Administrador de la plataforma", email: "admin@plataforma.invalid", empresa: "(ninguna)", descripcion: "Panel /admin: empresas, códigos de alta, errores." },
  { rol: "soporte", etiqueta: "Soporte técnico (acceso concedido)", email: "soporte@soporte-desarrollo.invalid", empresa: "Reformas Salvia", descripcion: "Cuenta de soporte con acceso vigente a la empresa A." },
];

/** Códigos que la galería o el registro pueden ofrecer. */
export const CODIGOS_DEMO = {
  empresaA: "5A1F0A01",
  empresaB: "E1E2B3C4",
  altaLibre: "H7KQ-2MXD-9PWT",
} as const;

const AVISO = "2026-09-28"; // = AVISO_CONTROL_VERSION de lib/types.ts

// ---------------------------------------------------------------------------
// Generadores de archivos pequeños y válidos
// ---------------------------------------------------------------------------

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Un "ticket" de compra dibujado en SVG (sirve como imagen de recibo). */
function svgTicket(proveedor: string, importe: number, fecha: string, concepto: string): string {
  const recorta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">` +
    `<rect width="360" height="520" fill="#fdfcf8"/>` +
    `<rect x="14" y="14" width="332" height="492" fill="none" stroke="#c9c4b5" stroke-dasharray="6 4"/>` +
    `<text x="180" y="62" text-anchor="middle" font-family="monospace" font-size="20" font-weight="bold" fill="#2b2b2b">${xml(recorta(proveedor, 24))}</text>` +
    `<text x="180" y="86" text-anchor="middle" font-family="monospace" font-size="12" fill="#6b6b6b">TICKET DE EJEMPLO · NO VÁLIDO</text>` +
    `<line x1="36" y1="106" x2="324" y2="106" stroke="#c9c4b5"/>` +
    `<text x="36" y="136" font-family="monospace" font-size="13" fill="#2b2b2b">Fecha: ${xml(fecha)}</text>` +
    `<text x="36" y="172" font-family="monospace" font-size="13" fill="#2b2b2b">${xml(recorta(concepto, 34))}</text>` +
    `<text x="36" y="200" font-family="monospace" font-size="13" fill="#6b6b6b">1 x ${xml(euros(importe))}</text>` +
    `<line x1="36" y1="226" x2="324" y2="226" stroke="#c9c4b5"/>` +
    `<text x="36" y="262" font-family="monospace" font-size="18" font-weight="bold" fill="#2b2b2b">TOTAL</text>` +
    `<text x="324" y="262" text-anchor="end" font-family="monospace" font-size="18" font-weight="bold" fill="#2b2b2b">${xml(euros(importe))}</text>` +
    `<text x="180" y="470" text-anchor="middle" font-family="monospace" font-size="11" fill="#9a9a9a">Gracias por su compra</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Un WAV mono de 8 kHz y 8 bits, en silencio, de `segundos` segundos. */
function wavSilencio(segundos: number): string {
  const muestras = 8000 * segundos;
  const bytes = new Uint8Array(44 + muestras);
  const v = new DataView(bytes.buffer);
  const txt = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
  };
  txt(0, "RIFF");
  v.setUint32(4, 36 + muestras, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  txt(36, "data");
  v.setUint32(40, muestras, true);
  bytes.fill(0x80, 44);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

function mulberry32(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const aMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

// ---------------------------------------------------------------------------
// La semilla
// ---------------------------------------------------------------------------

type GastoSemilla = {
  obra: 1 | 2 | 3;
  dias: number;
  importe: number;
  cat: string;
  prov: string | null;
  concepto: string | null;
  personal?: boolean;
  recibo?: boolean;
  legado?: boolean;
};

export function sembrar(escenario: Escenario, hoy: Date): Almacen {
  const a = almacenVacio();
  const vacio = escenario === "vacio";
  const largo = escenario === "textos-largos";
  const H = madrid(hoy).fecha;
  const d = (n: number) => sumarDias(H, n);
  const en = (n: number, hora: string) => instante(d(n), hora);
  const ahoraISO = hoy.toISOString();
  const rnd = mulberry32(20260928);

  // Textos: variantes largas para probar el ajuste de línea.
  const Ln = (s: string) => (largo ? `${s} de la Torre Fernández-Villalobos y Gómez de la Serna` : s);
  const Lt = (s: string) =>
    largo
      ? `${s}. Incluye todos los trabajos previos, la mano de obra, los materiales auxiliares, el transporte hasta la obra y la retirada posterior de sobrantes, según lo acordado con la propiedad y la dirección facultativa.`
      : s;
  const T = (corto: string, largoTexto: string) => (largo ? largoTexto : corto);

  let contador = 0;
  const id = () => `5eed0000-0000-4000-8000-${(++contador).toString(16).padStart(12, "0")}`;

  const especial = (e: string): unknown => {
    switch (e) {
      case "uuid":
        return id();
      case "ahora":
        return ahoraISO;
      case "serie":
        return a.sigErrorId++;
      default:
        throw new Error(`La semilla debe indicar explícitamente el valor por defecto "${e}".`);
    }
  };
  const poner = (tabla: Tabla, fila: Fila): Fila => {
    const f = rellenarFila(tabla, fila, especial as Parameters<typeof rellenarFila>[2]);
    a.tablas[tabla].push(f);
    return f;
  };

  // --- Cuentas -------------------------------------------------------------
  const cuentas: Record<string, string> = {};
  for (const c of CUENTAS_DEMO) {
    const uid = id();
    cuentas[c.email] = uid;
    a.usuarios.push({
      id: uid,
      email: c.email,
      password: CONTRASENA_DEMO,
      confirmado: true,
      meta: {},
      created_at: en(-300, "10:00"),
    });
  }
  const uid = (email: string) => cuentas[email];

  // --- Empresas ------------------------------------------------------------
  const empA = poner("empresas", { id: id(), nombre: "Reformas Salvia", created_at: en(-300, "09:00"), codigo: "5a1f0a01", activa_hasta: en(240, "00:00") }).id as string;
  const empB = poner("empresas", { id: id(), nombre: "Construcciones Ejemplo", created_at: en(-200, "09:00"), codigo: "e1e2b3c4", activa_hasta: en(9, "00:00") }).id as string;
  const empC = poner("empresas", { id: id(), nombre: "Carpintería Roble", created_at: en(-250, "09:00"), codigo: "c0c0a3b7", activa_hasta: en(-20, "00:00") }).id as string;

  const dueA = uid("marta.salvia@reformas-salvia.invalid");
  const dueB = uid("ana.ejemplo@construcciones-ejemplo.invalid");

  // --- Datos de negocio: se crean primero para poder enlazar las cuentas ----
  const ids = { obraA1: "", obraA2: "", obraA3: "", obraB1: "", obraB2: "", diego: "", irene: "", ivan: "", nerea: "" };

  type Trab = { id: string; nombre: string };
  const crew: Record<string, Trab> = {};
  const vehi: Record<string, string> = {};

  if (!vacio) {
    // ---------- Empresa A: obras ----------
    const o1 = poner("obras", {
      id: id(),
      owner_id: dueA,
      empresa_id: empA,
      nombre: T("Reforma integral vivienda Calle Olmo 14", "Rehabilitación integral del edificio residencial de la calle Mayor número 128, bloque B"),
      direccion: T("Calle Olmo 14, 28012 Madrid", "Calle Mayor, 128, bloque B, escalera izquierda, 3.º derecha, 28013 Madrid, junto a la antigua plaza del mercado"),
      activa: true,
      created_at: en(-85, "09:00"),
      lat: 40.4168,
      lng: -3.7038,
      radio_metros: 150,
      hora_inicio_turno: "07:30",
      minutos_antes_permitidos: 30,
    });
    const o2 = poner("obras", {
      id: id(),
      owner_id: dueA,
      empresa_id: empA,
      nombre: T("Rehabilitación fachada Plaza Mayor 3", "Reparación y pintura de la fachada principal y de los patios interiores de la comunidad de propietarios de la Plaza Mayor número 3"),
      direccion: T("Plaza Mayor 3, 28005 Madrid", "Plaza Mayor, 3, portal B, entrada de servicio por el callejón trasero, 28005 Madrid"),
      activa: true,
      created_at: en(-34, "09:00"),
    });
    const o3 = poner("obras", {
      id: id(),
      owner_id: dueA,
      empresa_id: empA,
      nombre: T("Cocina y baño Avenida del Sol 22", "Reforma completa de cocina y dos cuartos de baño en la vivienda unifamiliar de la Avenida del Sol número 22"),
      direccion: T("Avenida del Sol 22, 28901 Getafe", "Avenida del Sol, 22, urbanización Los Almendros, 28901 Getafe (Madrid)"),
      activa: false,
      created_at: en(-160, "09:00"),
    });
    ids.obraA1 = o1.id as string;
    ids.obraA2 = o2.id as string;
    ids.obraA3 = o3.id as string;

    // ---------- Empresa A: cuadrilla ----------
    const nombresCrew: [string, string, boolean][] = [
      ["diego", "Diego Navarro", true],
      ["irene", "Irene Campos", true],
      ["samuel", "Samuel Ortiz", true],
      ["lucia", "Lucía Ferrer", true],
      ["hugo", "Hugo Molina", true],
      ["carmen", "Carmen Rivas", true],
      ["andres", "Andrés Pardo", true],
      ["noelia", "Noelia Gil", true],
      ["tomas", "Tomás Beltrán", false],
    ];
    for (const [clave, nombre, activo] of nombresCrew) {
      const f = poner("trabajadores", { id: id(), owner_id: dueA, empresa_id: empA, nombre: Ln(nombre), activo, created_at: en(-290, "09:00") });
      crew[clave] = { id: f.id as string, nombre: f.nombre as string };
    }
    ids.diego = crew.diego.id;
    ids.irene = crew.irene.id;

    // ---------- Empresa A: vehículos ----------
    vehi.master = poner("vehiculos", { id: id(), owner_id: dueA, empresa_id: empA, nombre: Ln("Furgoneta Renault Master"), activo: true, created_at: en(-290, "09:00") }).id as string;
    vehi.iveco = poner("vehiculos", { id: id(), owner_id: dueA, empresa_id: empA, nombre: Ln("Camión Iveco Daily"), activo: true, created_at: en(-290, "09:00") }).id as string;
    vehi.berlingo = poner("vehiculos", { id: id(), owner_id: dueA, empresa_id: empA, nombre: Ln("Furgoneta Citroën Berlingo (vendida)"), activo: false, created_at: en(-290, "09:00") }).id as string;

    // ---------- Empresa B ----------
    const ob1 = poner("obras", { id: id(), owner_id: dueB, empresa_id: empB, nombre: T("Nave logística Polígono Norte", "Construcción de nave logística con oficinas y muelles de carga en la parcela 14 del Polígono Industrial Norte"), direccion: "Calle del Yunque 8, 28806 Alcalá de Henares", activa: true, created_at: en(-60, "09:00"), lat: 40.4819, lng: -3.3635, radio_metros: 200, hora_inicio_turno: "08:00", minutos_antes_permitidos: 30 });
    const ob2 = poner("obras", { id: id(), owner_id: dueB, empresa_id: empB, nombre: T("Reforma oficinas Edificio Centro", "Reforma integral de las oficinas de la planta cuarta del Edificio Centro, con nueva climatización y falsos techos"), direccion: "Paseo de la Estación 31, 28800 Alcalá de Henares", activa: true, created_at: en(-20, "09:00") });
    ids.obraB1 = ob1.id as string;
    ids.obraB2 = ob2.id as string;
  }

  // --- Miembros --------------------------------------------------------------
  const miembro = (email: string, nombre: string, rol: string, empresa: string, extra: Fila = {}) =>
    poner("miembros", {
      user_id: uid(email),
      email,
      nombre,
      rol,
      aprobado: true,
      empresa_id: empresa,
      created_at: en(-290, "10:00"),
      aviso_control_leido_en: en(-20, "09:00"),
      aviso_control_version: AVISO,
      es_soporte: false,
      ...extra,
    });

  // A
  miembro("marta.salvia@reformas-salvia.invalid", "Marta Salvia Ortega", "dueno", empA, { created_at: en(-300, "09:30") });
  miembro("luis.ortega@reformas-salvia.invalid", "Luis Ortega Prieto", "manager", empA);
  miembro("raquel.vidal@reformas-salvia.invalid", "Raquel Vidal Lozano", "jefe_obra", empA, { obra_id: ids.obraA1 || null });
  const diegoM = miembro("diego.navarro@reformas-salvia.invalid", "Diego Navarro Ibáñez", "trabajador", empA, { trabajador_id: ids.diego || null });
  void diegoM;
  miembro("irene.campos@reformas-salvia.invalid", "Irene Campos Soler", "trabajador", empA, {
    trabajador_id: ids.irene || null,
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });
  miembro("pablo.reyes@reformas-salvia.invalid", "Pablo Reyes Marín", "trabajador", empA, {
    aprobado: false,
    created_at: en(-1, "18:20"),
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });
  // soporte con acceso vigente
  miembro("soporte@soporte-desarrollo.invalid", "Soporte técnico", "dueno", empA, {
    es_soporte: true,
    created_at: en(-1, "10:00"),
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });

  // B
  miembro("ana.ejemplo@construcciones-ejemplo.invalid", "Ana Ejemplo Ruiz", "dueno", empB, { created_at: en(-200, "09:30") });
  miembro("javier.cano@construcciones-ejemplo.invalid", "Javier Cano Ríos", "manager", empB);
  miembro("sara.pons@construcciones-ejemplo.invalid", "Sara Pons Vidal", "jefe_obra", empB, { obra_id: ids.obraB1 || null });

  // trabajadores de B (necesitan ids de tarjeta antes de enlazarlos)
  const crewB: Record<string, Trab> = {};
  if (!vacio) {
    for (const [clave, nombre] of [["ivan", "Iván Soto"], ["nerea", "Nerea Lara"], ["ruben", "Rubén Cano"], ["alba", "Alba Montes"]] as const) {
      const f = poner("trabajadores", { id: id(), owner_id: dueB, empresa_id: empB, nombre: Ln(nombre), activo: true, created_at: en(-190, "09:00") });
      crewB[clave] = { id: f.id as string, nombre: f.nombre as string };
    }
    ids.ivan = crewB.ivan.id;
    ids.nerea = crewB.nerea.id;
  }
  miembro("ivan.soto@construcciones-ejemplo.invalid", "Iván Soto Ferrer", "trabajador", empB, { trabajador_id: ids.ivan || null });
  miembro("nerea.lara@construcciones-ejemplo.invalid", "Nerea Lara Gil", "trabajador", empB, {
    trabajador_id: ids.nerea || null,
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });
  miembro("oscar.gil@construcciones-ejemplo.invalid", "Óscar Gil Peña", "trabajador", empB, {
    aprobado: false,
    created_at: en(-2, "12:00"),
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });

  // C (caducada) y el administrador (fila propia pendiente: crear_miembro la crea al registrarse)
  miembro("gloria.roble@carpinteria-roble.invalid", "Gloria Roble Sanz", "dueno", empC, { created_at: en(-250, "09:30") });
  miembro("admin@plataforma.invalid", "Administración Plataforma", "trabajador", empC, {
    aprobado: false,
    created_at: en(-300, "08:00"),
    aviso_control_leido_en: null,
    aviso_control_version: null,
  });
  poner("admins_plataforma", { user_id: uid("admin@plataforma.invalid") });

  poner("soporte_accesos", {
    id: id(),
    empresa_id: empA,
    otorgado_a: uid("soporte@soporte-desarrollo.invalid"),
    email: "soporte@soporte-desarrollo.invalid",
    otorgado_por: dueA,
    otorgado_en: en(-1, "10:00"),
    expira_en: en(2, "10:00"),
  });

  // --- Códigos de alta y errores (nivel plataforma) ---------------------------
  const admin = uid("admin@plataforma.invalid");
  poner("codigos_alta", { id: id(), codigo: "R4NB-6YCE-3JVG", nota: "Reformas Salvia", creado_por: admin, creado_en: en(-301, "12:00"), usado_en: en(-300, "09:00"), usado_por: dueA, empresa_id: empA });
  poner("codigos_alta", { id: id(), codigo: "T8DW-5FHZ-4KMA", nota: "Construcciones Ejemplo", creado_por: admin, creado_en: en(-201, "12:00"), usado_en: en(-200, "09:00"), usado_por: dueB, empresa_id: empB });
  poner("codigos_alta", { id: id(), codigo: CODIGOS_DEMO.altaLibre, nota: "Cliente de la feria (demo)", creado_por: admin, creado_en: en(-3, "11:00") });
  poner("codigos_alta", { id: id(), codigo: "C2XS-7LPA-8QRN", nota: "Duplicado: cancelado", creado_por: admin, creado_en: en(-25, "11:00"), cancelado_en: en(-20, "11:00") });
  poner("codigos_alta", {
    id: id(),
    codigo: "M3GZ-9TKB-6WEH",
    nota: "Pago con tarjeta",
    creado_en: en(-1, "15:30"),
    email: "cliente.pago@correo.invalid",
    stripe_session_id: "cs_test_demo_0001",
    stripe_customer_id: "cus_demo_0001",
    stripe_subscription_id: "sub_demo_0001",
    pagado_hasta: en(365, "00:00"),
  });

  poner("errores_app", { creado_en: en(0, "07:12"), origen: "navegador", mensaje: "TypeError: Cannot read properties of undefined (reading 'nombre')", detalle: "at ObraCard (app/obras/page.tsx:88:21)\nat renderWithHooks (react-dom)", ruta: "/obras", navegador: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36", user_id: dueA, empresa_id: empA });
  poner("errores_app", { creado_en: en(-1, "16:40"), origen: "servidor", mensaje: "Fallo al generar el Excel de horas del mes", detalle: "RangeError: Invalid time value\n    at exportarHoras (lib/exportar-excel.ts:41:9)", ruta: "/api/exportar", navegador: null, user_id: dueA, empresa_id: empA });
  poner("errores_app", { creado_en: en(-3, "09:05"), origen: "navegador", mensaje: "ChunkLoadError: Loading chunk 412 failed.", detalle: null, ruta: "/fichar", navegador: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1", user_id: null, empresa_id: null });
  poner("errores_app", { creado_en: en(-6, "13:22"), origen: "navegador", mensaje: "Error de red al guardar el fichaje", detalle: "TypeError: Failed to fetch", ruta: "/fichar", navegador: "Mozilla/5.0 (Linux; Android 13) Chrome/125.0 Mobile Safari/537.36", user_id: uid("diego.navarro@reformas-salvia.invalid"), empresa_id: empA });

  if (vacio) return a;

  // =========================================================================
  // Empresa A: dinero, horas, planificación
  // =========================================================================
  const obraDe = { 1: ids.obraA1, 2: ids.obraA2, 3: ids.obraA3 } as const;

  // ---------- Proveedores ----------
  const proveedoresA: [string, boolean][] = [
    ["Leroy Merlin", true],
    ["Obramat", true],
    ["BigMat", true],
    ["Saneamientos Díaz", false],
    ["Pinturas Almagro", false],
    ["Ferretería La Llave", false],
    ["Alquileres Maquinaria Sur", false],
    ["Electricidad Hnos. Ruiz", false],
    ["Contenedores Hermanos Vega", false],
    ["Cristalería Núñez", false],
    ["Repsol", false],
  ];
  const nombreProv = (p: string) => (largo && !["Leroy Merlin", "Obramat", "BigMat"].includes(p) ? `${p} — Suministros Integrales de Construcción y Rehabilitación del Centro Peninsular, S. L.` : p);
  for (const [nombre, fav] of proveedoresA) {
    poner("proveedores", { id: id(), owner_id: dueA, empresa_id: empA, nombre: nombreProv(nombre), favorito: fav, created_at: en(-280, "09:00") });
  }
  for (const nombre of ["Aceros y Mallas del Henares", "Hormigones Cisneros"]) {
    poner("proveedores", { id: id(), owner_id: dueB, empresa_id: empB, nombre, favorito: false, created_at: en(-150, "09:00") });
  }

  // ---------- Fichajes ----------
  const fichaje = (obra: string, trab: Trab, fecha: string, ent: string | null, sal: string | null, extra: Fila = {}) =>
    poner("fichajes", {
      id: id(),
      obra_id: obra,
      trabajador_id: trab.id,
      fecha,
      hora_entrada: ent,
      hora_salida: sal,
      created_at: instante(fecha, ent ?? "08:00"),
      ...extra,
    });
  const historial = (f: Fila, antes: [string | null, string | null], despues: [string | null, string | null], por: string, cuando: string) =>
    poner("fichajes_historial", {
      id: id(),
      fichaje_id: f.id,
      obra_id: f.obra_id,
      trabajador_id: f.trabajador_id,
      fecha: f.fecha,
      hora_entrada_antes: antes[0],
      hora_salida_antes: antes[1],
      hora_entrada_despues: despues[0],
      hora_salida_despues: despues[1],
      cambiado_por: por,
      cambiado_en: cuando,
    });

  const zonas = ["Planta 1", "Cocina", "Baño principal", "Salón y pasillo", "Dormitorios", "Terraza"];
  type Asig = { clave: string; obra: string; base: number; transporte: string | null; traidoPor?: string };
  const asignaciones: Asig[] = [
    { clave: "diego", obra: ids.obraA1, base: aMin("07:30"), transporte: "propio" },
    { clave: "irene", obra: ids.obraA1, base: aMin("07:30"), transporte: "traido", traidoPor: crew.diego.nombre },
    { clave: "samuel", obra: ids.obraA1, base: aMin("07:35"), transporte: "propio" },
    { clave: "lucia", obra: ids.obraA1, base: aMin("07:30"), transporte: null },
    { clave: "hugo", obra: ids.obraA1, base: aMin("07:40"), transporte: "traido", traidoPor: crew.samuel.nombre },
    { clave: "carmen", obra: ids.obraA2, base: aMin("08:00"), transporte: null },
    { clave: "andres", obra: ids.obraA2, base: aMin("08:00"), transporte: "propio" },
    { clave: "noelia", obra: ids.obraA2, base: aMin("08:05"), transporte: null },
  ];
  const sinCerrar = new Set([`${d(-3)}|samuel`, `${d(-9)}|hugo`, `${d(-16)}|noelia`]);
  const corregidos = new Map<string, [string, string]>([
    [`${d(-5)}|irene`, ["08:20", "07:35"]],
    [`${d(-12)}|carmen`, ["08:40", "08:00"]],
  ]);

  for (let k = -30; k <= -1; k++) {
    const fecha = d(k);
    const dia = diaSemana(fecha);
    if (dia === 0 || dia === 6) continue;
    for (const as of asignaciones) {
      if (rnd() < 0.07) continue; // falta algún día
      const clave = `${fecha}|${as.clave}`;
      const entMin = as.base + Math.floor(rnd() * 20);
      const extraMin = rnd() < 0.2 ? 90 + Math.floor(rnd() * 120) : Math.floor(rnd() * 25);
      let ent = hhmm(entMin);
      const sal = sinCerrar.has(clave) ? null : hhmm(entMin + 8 * 60 + extraMin);
      const corr = corregidos.get(clave);
      const extra: Fila = {
        transporte: as.transporte,
        traido_por: as.transporte === "traido" ? as.traidoPor : null,
        ubicacion: as.obra === ids.obraA1 ? zonas[Math.floor(rnd() * zonas.length)] : null,
        ubicacion_ok: as.obra === ids.obraA1 ? true : null,
        distancia_metros: as.obra === ids.obraA1 ? 8 + Math.floor(rnd() * 80) : null,
      };
      if (corr) {
        ent = corr[1];
        extra.hora_corregida = true;
        extra.confirmado_trabajador = true;
      }
      const f = fichaje(as.obra, crew[as.clave], fecha, ent, sal, extra);
      if (corr) historial(f, [corr[0], sal], [ent, sal], dueA, instante(fecha, "18:30"));
    }
  }

  // Obra cerrada: unos días de hace mes y medio
  for (const clave of ["carmen", "andres", "tomas"]) {
    for (let k = -50; k <= -44; k++) {
      const fecha = d(k);
      if ([0, 6].includes(diaSemana(fecha))) continue;
      fichaje(ids.obraA3, crew[clave], fecha, "08:00", "16:30");
    }
  }

  // Hoy: fichado a medias
  const hoyF = (obra: string, clave: string, ent: string | null, sal: string | null, extra: Fila = {}) => fichaje(obra, crew[clave], H, ent, sal, extra);
  hoyF(ids.obraA1, "diego", "07:32", null, { transporte: "propio", ubicacion: "Cocina", ubicacion_ok: true, distancia_metros: 18 });
  hoyF(ids.obraA1, "irene", "07:41", null, { transporte: "traido", traido_por: crew.diego.nombre, ubicacion: "Cocina", ubicacion_ok: true, distancia_metros: 25 });
  hoyF(ids.obraA1, "samuel", "07:50", null, { transporte: "propio", ubicacion: "Baño principal", ubicacion_ok: false, distancia_metros: 420 });
  const corregidoHoy = hoyF(ids.obraA1, "lucia", "07:45", null, { hora_corregida: true, confirmado_trabajador: false, ubicacion: "Salón y pasillo", ubicacion_ok: true, distancia_metros: 12 });
  historial(corregidoHoy, ["08:30", null], ["07:45", null], dueA, instante(H, "07:20"));
  hoyF(ids.obraA2, "carmen", "08:02", "12:30");
  hoyF(ids.obraA2, "andres", "08:10", null, { transporte: "propio" });

  // ---------- Vehículos: uso esta semana ----------
  const uso = (veh: string, fecha: string, obra: string, destino: string, conductor: string) =>
    poner("usos_vehiculo", { id: id(), obra_id: obra, vehiculo_id: veh, fecha, destino: Lt(destino), conductor_id: crew[conductor].id, created_at: instante(fecha, "08:30") });
  for (let k = -6; k <= 0; k++) {
    const fecha = d(k);
    const dia = diaSemana(fecha);
    if ((dia === 0 || dia === 6) && k !== 0) continue;
    uso(vehi.master, fecha, ids.obraA1, "Material y herramienta a la obra", "diego");
    if (k === 0) uso(vehi.master, fecha, ids.obraA2, "Recogida de pintura para la fachada", "diego");
    if (k === -1 || k === -3) uso(vehi.iveco, fecha, ids.obraA2, "Transporte de andamio y escombros", "samuel");
  }

  // ---------- Gastos ----------
  const gastos: GastoSemilla[] = [
    { obra: 1, dias: -70, importe: 1480.5, cat: "Material", prov: "BigMat", concepto: "Tabiquería y yeso laminado", recibo: true },
    { obra: 1, dias: -66, importe: 312.4, cat: "Gestión de residuos", prov: "Contenedores Hermanos Vega", concepto: "Contenedor de 5 m³ para escombros", recibo: true },
    { obra: 1, dias: -60, importe: 86.9, cat: "Combustible", prov: "Repsol", concepto: "Gasóleo de la furgoneta" },
    { obra: 1, dias: -55, importe: 642.15, cat: "Material", prov: "Leroy Merlin", concepto: "Mortero y cola para azulejos", recibo: true },
    { obra: 1, dias: -52, importe: 420, cat: "Mano de obra externa", prov: "Electricidad Hnos. Ruiz", concepto: "Cuadro eléctrico y cableado", recibo: true },
    { obra: 1, dias: -46, importe: 95.3, cat: "Material", prov: "Ferretería La Llave", concepto: "Tornillería y sellador" },
    { obra: 1, dias: -40, importe: 1250, cat: "Mano de obra externa", prov: "Saneamientos Díaz", concepto: "Fontanería: montaje de bajantes", recibo: true },
    { obra: 1, dias: -33, importe: 2340, cat: "Material", prov: "Obramat", concepto: "Porcelánico 60x60 para salón y pasillo", recibo: true },
    { obra: 1, dias: -30, importe: 180, cat: "Maquinaria / alquiler", prov: "Alquileres Maquinaria Sur", concepto: "Cortadora de azulejo, dos semanas" },
    { obra: 1, dias: -27, importe: 60, cat: "Sueldos", prov: null, concepto: "Pago en mano a peón de refuerzo", personal: true },
    { obra: 1, dias: -21, importe: 215.75, cat: "Material", prov: "Leroy Merlin", concepto: "Griferías y sanitarios", personal: true, recibo: true },
    { obra: 1, dias: -14, importe: 72.4, cat: "Combustible", prov: "Repsol", concepto: "Gasóleo de la furgoneta" },
    { obra: 1, dias: -9, importe: 390, cat: "Material", prov: "BigMat", concepto: "Pladur y perfilería", recibo: true },
    { obra: 1, dias: -6, importe: 45, cat: "Otros", prov: null, concepto: "Parking y peajes" },
    { obra: 1, dias: -3, importe: 128.6, cat: "Material", prov: "Obramat", concepto: "Rodapié y masilla", personal: true },
    { obra: 2, dias: -28, importe: 860, cat: "Maquinaria / alquiler", prov: "Alquileres Maquinaria Sur", concepto: "Andamio de fachada, un mes", recibo: true },
    { obra: 2, dias: -24, importe: 244.35, cat: "Material", prov: "Pinturas Almagro", concepto: "Imprimación y pintura de fachada", recibo: true },
    { obra: 2, dias: -18, importe: 150, cat: "Mano de obra externa", prov: "Cristalería Núñez", concepto: "Reposición de cristales dañados" },
    { obra: 2, dias: -15, importe: 98.2, cat: "Gestión de residuos", prov: "Contenedores Hermanos Vega", concepto: "Recogida de escombro" },
    { obra: 2, dias: -8, importe: 520, cat: "Sueldos", prov: null, concepto: "Pago a ayudante, semana 45", personal: true },
    { obra: 2, dias: -5, importe: 310.8, cat: "Material", prov: "Leroy Merlin", concepto: "Mortero de reparación", recibo: true },
    { obra: 2, dias: -2, importe: 64.9, cat: "Combustible", prov: "Repsol", concepto: "Gasóleo" },
    { obra: 3, dias: -62, importe: 725.4, cat: "Material", prov: "Obramat", concepto: "Azulejos del baño", recibo: true },
    { obra: 3, dias: -58, importe: 190, cat: "Mano de obra externa", prov: "Saneamientos Díaz", concepto: "Desatasco y prueba de presión" },
    { obra: 3, dias: -55, importe: 310, cat: "Otros", prov: "Electricidad Hnos. Ruiz", concepto: null, legado: true },
    { obra: 1, dias: -80, importe: 540, cat: "Otros", prov: "BigMat", concepto: null, legado: true },
  ];
  gastos.forEach((g, i) => {
    const obra = obraDe[g.obra];
    const fecha = d(g.dias);
    const proveedor = g.prov ? nombreProv(g.prov) : null;
    const concepto = g.concepto ? Lt(g.concepto) : null;
    let ruta: string | null = null;
    let origen: string | null = null;
    if (g.recibo || g.legado) {
      ruta = `${obra}/${g.legado ? "factura-antigua" : "gasto"}-${i + 1}.svg`;
      a.archivos[`facturas/${ruta}`] = { tipo: "image/svg+xml", dataUrl: svgTicket(g.prov ?? "Proveedor", g.importe, fecha, g.concepto ?? "Factura importada") };
    }
    if (g.legado) {
      origen = id();
      poner("facturas", { id: origen, obra_id: obra, proveedor, importe: g.importe, fecha, tipo_archivo: "image/svg+xml", nombre_archivo: `factura-${i + 1}.svg`, storage_path: ruta, created_at: instante(fecha, "12:00") });
    }
    poner("gastos", {
      id: id(),
      obra_id: obra,
      importe: g.importe,
      concepto,
      categoria: g.cat,
      fecha,
      recibo_path: ruta,
      recibo_tipo: ruta ? "image/svg+xml" : null,
      created_at: instante(fecha, "13:00"),
      pagado_por: g.personal ? "personal" : "empresa",
      proveedor,
      factura_origen_id: origen,
    });
  });

  // ---------- Cobros y entregas ----------
  const cobro = (obra: string, dias: number, importe: number, concepto: string | null, justificante = false) => {
    const fecha = d(dias);
    let ruta: string | null = null;
    if (justificante) {
      ruta = `${obra}/cobro-${fecha}.svg`;
      a.archivos[`facturas/${ruta}`] = { tipo: "image/svg+xml", dataUrl: svgTicket("Transferencia del cliente", importe, fecha, "Justificante de pago") };
    }
    poner("cobros", { id: id(), obra_id: obra, importe, fecha, concepto: concepto ? Lt(concepto) : null, archivo_path: ruta, archivo_tipo: ruta ? "image/svg+xml" : null, created_at: instante(fecha, "11:00") });
  };
  cobro(ids.obraA1, -70, 12000, "Primer pago: 30 % a la firma", true);
  cobro(ids.obraA1, -25, 9500, "Certificación número 2");
  cobro(ids.obraA2, -40, 6000, "Anticipo de la comunidad");
  cobro(ids.obraA3, -50, 4800, "Liquidación final");

  const entrega = (dias: number, importe: number, concepto: string | null, obra: string | null) => {
    const fecha = d(dias);
    poner("entregas", { id: id(), owner_id: dueA, empresa_id: empA, importe, fecha, concepto: concepto ? Lt(concepto) : null, obra_id: obra, created_at: instante(fecha, "10:00") });
  };
  entrega(-60, 2500, "Entrega para gastos de obra", ids.obraA1);
  entrega(-30, 1800, "Caja de la semana", ids.obraA2);
  entrega(-12, 1200, "Efectivo para pequeño material", null);
  entrega(-4, 900, null, null);

  // ---------- Planificación ----------
  const tarea = (obra: string, orden: number, nombre: string, ini: number, fin: number, avance: number, presupuesto: number | null) =>
    poner("tareas", { id: id(), obra_id: obra, nombre: Lt(nombre), fecha_inicio: d(ini), fecha_fin: d(fin), avance, orden, presupuesto, created_at: en(ini - 10, "09:00") });
  const p1 = ids.obraA1;
  tarea(p1, 1, "Demolición y retirada de escombros", -80, -66, 100, 4200);
  tarea(p1, 2, "Albañilería: tabiques y recrecidos", -65, -45, 100, 8800);
  tarea(p1, 3, "Instalación eléctrica", -50, -8, 85, 6400);
  tarea(p1, 4, "Fontanería y saneamiento", -45, 5, 70, 7300);
  tarea(p1, 5, "Solados y alicatados", -12, 25, 35, 11200);
  tarea(p1, 6, "Carpintería interior y cocina", 15, 50, 0, 15800);
  tarea(p1, 7, "Pintura y acabados", 45, 70, 0, 5600);
  tarea(p1, 8, "Limpieza final y entrega de llaves", 68, 75, 0, 1500);
  const p2 = ids.obraA2;
  tarea(p2, 1, "Andamio y protecciones", -30, -20, 100, 1800);
  tarea(p2, 2, "Reparación de la fachada", -19, 20, 55, 9400);
  tarea(p2, 3, "Pintura de la fachada", 18, 40, 0, 6200);
  tarea(p2, 4, "Retirada del andamio", 38, 45, 0, 900);
  const p3 = ids.obraA3;
  tarea(p3, 1, "Demolición de cocina y baño", -150, -140, 100, 2200);
  tarea(p3, 2, "Fontanería y electricidad", -139, -100, 100, 5400);
  tarea(p3, 3, "Alicatado y montaje", -99, -60, 100, 9100);

  // ---------- Notas de voz ----------
  const wav = wavSilencio(1);
  const nota = (obra: string, dias: number, seg: number) => {
    const fecha = d(dias);
    const ruta = `${obra}/nota-${fecha}.wav`;
    a.archivos[`notas/${ruta}`] = { tipo: "audio/wav", dataUrl: wav };
    poner("notas_audio", { id: id(), obra_id: obra, fecha, audio_path: ruta, duracion_seg: seg, created_at: instante(fecha, "17:45") });
  };
  nota(ids.obraA1, -2, 38);
  nota(ids.obraA1, -5, 52);
  nota(ids.obraA1, -12, 27);
  nota(ids.obraA2, -3, 44);

  // ---------- Ajustes de A ----------
  poner("ajustes", { owner_id: dueA, empresa_id: empA, jornada_horas: 8, updated_at: en(-100, "09:00") });

  // =========================================================================
  // Empresa B: poco, para comprobar el aislamiento
  // =========================================================================
  for (let k = -10; k <= -1; k++) {
    const fecha = d(k);
    if ([0, 6].includes(diaSemana(fecha))) continue;
    for (const clave of ["ivan", "nerea", "ruben"]) {
      const ent = 8 * 60 + Math.floor(rnd() * 15);
      fichaje(ids.obraB1, crewB[clave], fecha, hhmm(ent), hhmm(ent + 8 * 60 + Math.floor(rnd() * 30)));
    }
  }
  const gastoB = (obra: string, dias: number, importe: number, cat: string, prov: string, concepto: string) => {
    const fecha = d(dias);
    poner("gastos", { id: id(), obra_id: obra, importe, concepto, categoria: cat, fecha, proveedor: prov, created_at: instante(fecha, "13:00") });
  };
  gastoB(ids.obraB1, -40, 5230.8, "Material", "Aceros y Mallas del Henares", "Mallazo y armaduras");
  gastoB(ids.obraB1, -22, 3180, "Material", "Hormigones Cisneros", "Hormigón de la solera");
  gastoB(ids.obraB1, -9, 940, "Maquinaria / alquiler", "Alquileres del Henares", "Miniexcavadora");
  gastoB(ids.obraB2, -7, 410.25, "Material", "Pinturas del Centro", "Pintura plástica");
  gastoB(ids.obraB2, -3, 76, "Combustible", "Repsol", "Gasóleo");
  poner("cobros", { id: id(), obra_id: ids.obraB1, importe: 20000, fecha: d(-45), concepto: "Anticipo", created_at: en(-45, "11:00") });
  poner("tareas", { id: id(), obra_id: ids.obraB1, nombre: "Cimentación", fecha_inicio: d(-55), fecha_fin: d(-20), avance: 100, orden: 1, presupuesto: 38000, created_at: en(-60, "09:00") });
  poner("tareas", { id: id(), obra_id: ids.obraB1, nombre: "Estructura y cubierta", fecha_inicio: d(-19), fecha_fin: d(40), avance: 40, orden: 2, presupuesto: 92000, created_at: en(-60, "09:00") });

  return a;
}
