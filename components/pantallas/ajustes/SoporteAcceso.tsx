"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { localeActual, tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import { darAccesoSoporte, listarAccesosSoporte, revocarAccesoSoporte } from "@/lib/datos/consultas";
import type { SoporteAcceso as SoporteAccesoFila } from "@/lib/types";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { CargandoBloque } from "@/components/ui/Cargando";
import { SeccionAjustes } from "./SeccionListaActivable";

type Estado = "activo" | "caducado" | "revocado";

/** Estado de una concesión respecto a un instante dado (nunca Date.now() al pintar: lint react-hooks/purity). */
const estadoDe = (a: SoporteAccesoFila, ahora: number): Estado => {
  if (a.revocado_en) return "revocado";
  if (new Date(a.expira_en).getTime() < ahora) return "caducado";
  return "activo";
};

const ETIQUETA_ESTADO: Record<Estado, { texto: () => string; tono: "lima" | "coral" | "suave" }> = {
  activo: { texto: () => tr("Activo"), tono: "lima" },
  caducado: { texto: () => tr("Caducado"), tono: "coral" },
  revocado: { texto: () => tr("Revocado"), tono: "suave" },
};

/**
 * Soporte (AJU-03, SOLO el dueño): acceso de nivel dueño a una cuenta YA
 * REGISTRADA, por unas horas, con todo apuntado (quién, hasta cuándo, quién
 * lo quitó). Pasadas las horas se apaga solo. Los mensajes del servidor
 * («Esa cuenta todavía no existe…») se enseñan tal cual.
 */
export function SoporteAcceso() {
  const db = useDb();
  const [accesos, setAccesos] = useState<SoporteAccesoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [email, setEmail] = useState("");
  const [horas, setHoras] = useState("24");
  const [dando, setDando] = useState(false);
  const [error, setError] = useState("");
  const [quitando, setQuitando] = useState<string | null>(null);
  // «Ahora» vive en el estado y se renueva al cargar: así el estado
  // (activo/caducado) no depende de llamar a Date.now() al pintar (§20.5).
  const [ahora, setAhora] = useState(0);

  const cargar = useCallback(async () => {
    const { data, error: err } = await listarAccesosSoporte(db);
    setAhora(Date.now());
    setCargando(false);
    if (err) {
      setErrorCarga(esFalloDeRed(err) ? tr("Sin conexión. No se han podido cargar los datos.") : err.message);
      return;
    }
    setErrorCarga("");
    setAccesos(data ?? []);
  }, [db]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const horasNum = Number(horas);
  const horasValidas = Number.isFinite(horasNum) && horasNum >= 1 && horasNum <= 720;

  const darAcceso = async () => {
    setError("");
    setDando(true);
    const { error: err } = await darAccesoSoporte(db, email.trim(), horasNum);
    setDando(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEmail("");
    await cargar();
  };

  const revocar = async (id: string) => {
    setError("");
    setQuitando(id);
    const { error: err } = await revocarAccesoSoporte(db, id);
    setQuitando(null);
    // v1 no miraba el error al quitar el acceso (DIS-23).
    if (err) setError(err.message);
    await cargar();
  };

  return (
    <SeccionAjustes
      titulo={tr("Soporte")}
      descripcion={tr(
        "Dale acceso temporal al desarrollador para que pueda ayudarte. Tiene que haberse registrado antes con ese correo. Pasadas las horas, se le quita solo."
      )}
      testid="ajustes-soporte"
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim() && horasValidas) void darAcceso();
        }}
      >
        <Campo etiqueta={tr("Correo de la cuenta de soporte")} htmlFor="soporte-email">
          <Entrada
            id="soporte-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            placeholder={tr("soporte@ejemplo.com")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo etiqueta={tr("Horas de acceso")} htmlFor="soporte-horas">
          <Entrada
            id="soporte-horas"
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            aria-invalid={!horasValidas || undefined}
          />
        </Campo>
        {error && <Aviso tono="error">{error}</Aviso>}
        <Boton type="submit" ancho disabled={!email.trim() || !horasValidas} cargando={dando}>
          {tr("Dar acceso")}
        </Boton>
      </form>

      {cargando ? (
        <CargandoBloque alto="bloque" />
      ) : errorCarga ? (
        <Aviso tono="error">{errorCarga}</Aviso>
      ) : (
        accesos.length > 0 && (
          <ul className="grid gap-2">
            {accesos.map((a) => {
              const e = estadoDe(a, ahora);
              const etiqueta = ETIQUETA_ESTADO[e];
              return (
                <li key={a.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[10px] bg-fondo/60 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-base font-semibold">{a.email}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-peq text-tinta-2">
                      <Etiqueta tono={etiqueta.tono}>{etiqueta.texto()}</Etiqueta>
                      {e === "activo" && (
                        <span className="cifras">
                          {tr("Hasta {fecha}", {
                            fecha: new Date(a.expira_en).toLocaleString(localeActual(), {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  {e === "activo" && (
                    <Boton
                      variante="peligro"
                      onClick={() => revocar(a.id)}
                      cargando={quitando === a.id}
                      icono={<ShieldAlert size={18} aria-hidden />}
                    >
                      {tr("Quitar ya")}
                    </Boton>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
    </SeccionAjustes>
  );
}
