"use client";

import { useState } from "react";
import { Check, Hourglass, LockKeyhole, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { tr, trJsx } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import { confirmarAvisoControl } from "@/lib/datos/consultas";
import { useMiembro } from "@/lib/miembro-context";
import { obtenerPosicion } from "@/lib/geo";
import { AVISO_CONTROL_VERSION } from "@/lib/types";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Panel } from "@/components/ui/Panel";
import { Aviso } from "@/components/ui/Aviso";
import { PantallaPuerta } from "./PantallaPuerta";

/** ACC-09 — Cuenta registrada pero todavía sin aprobar: escribe su nombre y espera. */
export function PendienteAprobacion() {
  const { miembro, email, guardarNombre, refrescar } = useMiembro();
  const [nombre, setNombre] = useState(miembro?.nombre ?? "");
  const [guardando, setGuardando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState("");
  const yaTieneNombre = Boolean(miembro?.nombre);

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError("");
    const fallo = await guardarNombre(nombre.trim());
    if (fallo) setError(fallo);
    setGuardando(false);
  };

  const comprobar = async () => {
    setComprobando(true);
    await refrescar();
    setComprobando(false);
  };

  return (
    <PantallaPuerta icono={<Hourglass size={24} />} titulo={tr("Cuenta creada")}>
      <p className="mb-5 text-base leading-relaxed">
        {tr("Tu cuenta")} <strong className="break-all font-semibold">{email ?? ""}</strong>{" "}
        {tr("ya existe, pero todavía no tiene acceso a las obras. El dueño tiene que aprobarla.")}
      </p>

      <Panel>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <Campo
            etiqueta={tr("Tu nombre y apellido")}
            htmlFor="pendiente-nombre"
            pista={tr("Escríbelo como te conocen en la obra: es lo que verá el dueño para saber que eres tú.")}
            error={error || undefined}
          >
            <Entrada
              id="pendiente-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tr("Ej. Andrés Gómez")}
              autoComplete="name"
            />
          </Campo>
          <Boton
            type="submit"
            grande
            ancho
            disabled={!nombre.trim()}
            cargando={guardando}
            icono={yaTieneNombre ? <Check size={18} aria-hidden /> : undefined}
          >
            {yaTieneNombre ? tr("Nombre guardado") : tr("Enviar mi nombre")}
          </Boton>
        </form>
      </Panel>

      {yaTieneNombre && (
        <Panel tono="honda" className="mt-4 text-center">
          <p className="text-base font-medium">{tr("Esperando a que te den acceso")}</p>
          <p className="mt-1 text-peq text-sobre-honda-2">{tr("Avisa al dueño. En cuanto te apruebe, entra desde aquí.")}</p>
          <Boton
            variante="principal"
            className="mt-4"
            onClick={comprobar}
            cargando={comprobando}
            icono={<RefreshCw size={18} aria-hidden />}
          >
            {tr("Comprobar de nuevo")}
          </Boton>
        </Panel>
      )}
    </PantallaPuerta>
  );
}

/** ACC-10 — Prueba terminada o empresa bloqueada por el admin. No se borra nada. */
export function SuscripcionInactiva() {
  return (
    <PantallaPuerta icono={<LockKeyhole size={24} />} titulo={tr("Suscripción inactiva")} textoSalir={tr("Salir")}>
      <p className="text-base leading-relaxed">
        {tr(
          "El acceso de tu empresa está pausado. No se ha borrado nada: tus obras, horas y gastos siguen guardados y vuelven en cuanto se renueve la suscripción. Contacta con el administrador de la plataforma."
        )}
      </p>
    </PantallaPuerta>
  );
}

/**
 * ACC-11 — Aviso de control de horario (solo trabajadores), hasta que
 * acepta la versión vigente. Es un aviso informativo documentado, NO un
 * «consentimiento»: en una relación laboral el consentimiento pesa poco; lo
 * que cuenta es que quede constancia de que se le avisó, cuándo y de qué
 * versión. Nunca usar esa palabra en el texto.
 *
 * v2 (DIS: ACC-11): los párrafos de ubicación solo se muestran si el módulo
 * de geolocalización está encendido (en v1 salían siempre).
 */
export function AvisoControl() {
  const db = useDb();
  const { refrescar, modulos } = useMiembro();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const confirmar = async () => {
    setGuardando(true);
    setError("");
    // El permiso de ubicación se pide aquí, una sola vez y con la app ya
    // explicando para qué es; no cada vez que se ficha. Si dice que no, se
    // ficha igual: informa, nunca bloquea (FIC-07).
    if (modulos.geolocalizacion) await obtenerPosicion();
    const { error: err } = await confirmarAvisoControl(db, AVISO_CONTROL_VERSION);
    setGuardando(false);
    if (err) {
      setError(tr("No se pudo guardar. Inténtalo otra vez."));
      return;
    }
    await refrescar();
  };

  return (
    <PantallaPuerta icono={<ShieldCheck size={24} />} titulo={tr("Antes de fichar")}>
      <Panel className="grid gap-3 text-base leading-relaxed">
        <p>
          {tr("Esta app registra tu")} <strong className="font-semibold">{tr("hora de entrada y salida")}</strong>{" "}
          {tr("con el reloj del servidor, no con el del móvil.")}
        </p>
        {modulos.geolocalizacion && (
          <p>
            {trJsx(
              "Cuando fichas, la app también comprueba si tu móvil está {dentro}. No guarda tu ubicación exacta ni te sigue en ningún otro momento — solo ese resultado (dentro/fuera) en el instante de fichar.",
              { dentro: <strong className="font-semibold">{tr("dentro o fuera de la obra")}</strong> }
            )}
          </p>
        )}
        <p>
          {tr("Algunas obras tienen una")} <strong className="font-semibold">{tr("hora mínima para fichar la entrada")}</strong>
          {tr(", para que no se pueda marcar la llegada antes de que empiece el turno.")}
        </p>
      </Panel>

      {error && (
        <Aviso tono="error" className="mt-3">
          {error}
        </Aviso>
      )}
      {modulos.geolocalizacion && (
        <p className="mt-4 text-peq leading-relaxed">
          {tr(
            "Al tocar «Lo he leído», el móvil te va a pedir permiso de ubicación. Acéptalo — así, cada vez que fiches, no hace falta pedirlo otra vez."
          )}
        </p>
      )}
      <Boton grande ancho className="mt-4" onClick={confirmar} cargando={guardando}>
        {guardando ? tr("Guardando…") : tr("Lo he leído")}
      </Boton>
    </PantallaPuerta>
  );
}

/**
 * v2 — No se pudo leer la cuenta (sin cobertura o fallo del servidor). En
 * v1 este caso caía en «Cuenta creada / pendiente», que era mentira (DIS-13).
 */
export function SinConexionCuenta({ detalle, onReintentar }: { detalle: string; onReintentar: () => Promise<void> }) {
  const [probando, setProbando] = useState(false);
  return (
    <PantallaPuerta icono={<WifiOff size={24} />} titulo={tr("No se ha podido cargar")}>
      <p className="text-base leading-relaxed">{tr("Comprueba la conexión y vuelve a intentarlo.")}</p>
      <Aviso tono="error" className="mt-4">
        {detalle}
      </Aviso>
      <Boton
        grande
        ancho
        className="mt-4"
        cargando={probando}
        icono={<RefreshCw size={18} aria-hidden />}
        onClick={async () => {
          setProbando(true);
          await onReintentar();
          setProbando(false);
        }}
      >
        {tr("Reintentar")}
      </Boton>
    </PantallaPuerta>
  );
}
