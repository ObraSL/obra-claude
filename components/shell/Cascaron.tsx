"use client";

import dynamic from "next/dynamic";
import { useState, ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { Building2, RefreshCw } from "lucide-react";
import { tr } from "@/lib/i18n";
import { MODO_MEMORIA } from "@/lib/datos/db";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import { navLateral, navMovil } from "@/lib/nav";
import { CargandoBloque } from "@/components/ui/Cargando";
import { Hoja } from "@/components/ui/Hoja";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Vacio } from "@/components/ui/Vacio";
import { useSalir } from "@/components/puertas/PantallaPuerta";
import { BarraInferior, BarraLateral } from "./Navegacion";
import { BarraSuperior } from "./BarraSuperior";
import { FormObraNueva, SelectorObra } from "./SelectorObra";
import { Refresco } from "./Refresco";

/** Solo el modo demo (con «?demo=1»): botón para cambiar entre director y trabajador. */
const CambiarRolDemo = MODO_MEMORIA ? dynamic(() => import("@/components/demo/CambiarRolDemo"), { ssr: false }) : null;

/**
 * El armazón del panel (SHL-01): barra lateral en el ordenador (≥ 768 px),
 * barra superior + cápsula inferior en el móvil, y el contenido centrado
 * (máx. ≈ 768 px). Contenedor: lee los contextos y reparte props a vistas
 * que no saben nada de datos.
 */
export function Cascaron({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { obras, obraActual, obraId, setObraId, crearObra, loading, error, refrescar } = useObra();
  const { rol, modulos, gestiona, administra } = useMiembro();
  const salir = useSalir("/login");
  const [eligiendo, setEligiendo] = useState(false);

  const crear = async (nombre: string, direccion: string) => {
    const { error: fallo } = await crearObra(nombre, direccion);
    if (!fallo) setEligiendo(false);
    return fallo;
  };

  return (
    <div className="flex min-h-[100dvh]">
      <BarraLateral items={navLateral(rol, modulos)} pathname={pathname} onSalir={salir} />
      {/* min-w-0 es imprescindible (T-07): un hijo de flex no se encoge por
          debajo del ancho de su contenido; sin esto una tarjeta ancha
          estiraba TODA la página y el iPhone la dejaba arrastrar de lado. */}
      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        {obras.length > 0 && (
          <BarraSuperior obra={obraActual} gestiona={gestiona} onElegirObra={() => setEligiendo(true)} />
        )}
        <main className="min-w-0 flex-1">
          {loading ? (
            <CargandoBloque alto="bloque" />
          ) : error && obras.length === 0 ? (
            <div className="mx-auto max-w-sm px-5 py-12">
              <Aviso tono="error">{error}</Aviso>
              <Boton ancho grande className="mt-4" onClick={() => refrescar()} icono={<RefreshCw size={18} aria-hidden />}>
                {tr("Reintentar")}
              </Boton>
            </div>
          ) : obras.length === 0 ? (
            // Solo quien puede crear obras ve el formulario de «crea la primera» (SHL-06).
            administra ? (
              <div className="mx-auto max-w-sm px-5 py-10">
                <Vacio
                  titulo={<span className="text-h1">{tr("Crea tu primera obra")}</span>}
                  texto={tr("Fichajes, gastos y facturas se organizan por obra.")}
                  className="!pb-2"
                />
                <FormObraNueva onCrear={crear} />
              </div>
            ) : (
              <div className="mx-auto max-w-sm px-5 py-16 text-center">
                <Building2 size={30} aria-hidden className="mx-auto mb-3 opacity-80" />
                <h1 className="text-h1 font-medium">{tr("Todavía no hay obra")}</h1>
                <p className="mt-2 text-base">{tr("Cuando te asignen una obra la verás aquí y podrás fichar tus horas.")}</p>
              </div>
            )
          ) : (
            <Refresco>
              <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-10 md:pt-6">
                {/* Al cambiar de pantalla, la de salida y la de entrada se deslizan
                    según el tipo de salto de <Link> (lib/nav.ts · tipoSalto); sin tipo
                    (p. ej. «atrás» del navegador) solo hay un fundido corto. Las
                    reglas visuales están en globals.css («Transiciones»). */}
                <ViewTransition
                  key={pathname}
                  enter={{ adelante: "pag-adelante", atras: "pag-atras", default: "pag-fundido" }}
                  exit={{ adelante: "pag-adelante", atras: "pag-atras", default: "pag-fundido" }}
                  default="none"
                >
                  <div>{children}</div>
                </ViewTransition>
              </div>
            </Refresco>
          )}
        </main>
        {obras.length > 0 && <BarraInferior items={navMovil(rol, modulos)} pathname={pathname} />}
      </div>

      {CambiarRolDemo && <CambiarRolDemo />}

      {eligiendo && (
        <Hoja titulo={tr("Elegir obra")} onCerrar={() => setEligiendo(false)}>
          <SelectorObra
            obras={obras}
            obraId={obraId}
            puedeCrear={administra}
            onElegir={(id) => {
              setObraId(id);
              setEligiendo(false);
            }}
            onCrear={crear}
          />
        </Hoja>
      )}
    </div>
  );
}
