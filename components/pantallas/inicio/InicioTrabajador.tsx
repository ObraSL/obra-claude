"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, LogIn, LogOut, MapPin } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import { avanceObra, fichajesDeHoyDelTrabajador, horasDelMesDeTrabajador } from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { Fichaje } from "@/lib/types";
import { currentMonth, monthBounds, monthLabel, todayStr } from "@/lib/format";
import { fmtHoras, totalesFichajes } from "@/lib/horas";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { useEnRefresco } from "@/components/shell/Refresco";
import { FotoObra } from "@/components/marca/FotoObra";
import { CifraAvance } from "@/components/marca/CifraAvance";
import { Panel } from "@/components/ui/Panel";
import { Aviso } from "@/components/ui/Aviso";
import { Dato } from "./VistaInicioGestor";

export type PropsInicioTrabajador = {
  obraNombre: string;
  obraDireccion: string | null;
  error: string;
  /** Avance de la obra (0–100) o null si no se puede ver. Nunca presupuestos ni dinero (HOM-W2). */
  avance: number | null;
  mes: { trabajados: number; extra: number; dias: number };
  entradaHoy: string | null;
  salidaHoy: string | null;
};

/**
 * Inicio del trabajador (HOM-W1…HOM-W5). Lo primero, arriba y enorme, es
 * LA acción del día: ir a fichar (dos toques desde que abre la app).
 */
export function VistaInicioTrabajador(p: PropsInicioTrabajador) {
  const accion = p.entradaHoy && !p.salidaHoy ? tr("Marcar mi salida") : p.entradaHoy ? tr("Mis horas de hoy") : tr("Marcar mi entrada");
  const pendienteDeFichar = !p.entradaHoy || !p.salidaHoy;

  return (
    <div className="grid gap-4">
      <header className="min-w-0">
        <h1 className="break-words text-h1 font-medium tracking-[-0.02em]">{p.obraNombre}</h1>
        {p.obraDireccion && (
          <p className="mt-0.5 flex items-start gap-1.5 text-base">
            <MapPin size={16} aria-hidden className="mt-1 shrink-0" />
            <span className="min-w-0 break-words">{p.obraDireccion}</span>
          </p>
        )}
      </header>

      {p.error && <Aviso tono="error">{p.error}</Aviso>}

      <Link
        href="/fichajes"
        data-testid="ir-a-fichar"
        className={
          "flex min-h-[76px] items-center justify-between gap-3 rounded-[10px] px-5 py-4 text-titulo font-medium active:scale-[0.985] " +
          (pendienteDeFichar ? "bg-lima text-sobre-lima" : "bg-negro text-sobre-negro")
        }
      >
        <span className="min-w-0 break-words">{accion}</span>
        <ArrowRight size={26} aria-hidden className="shrink-0" />
      </Link>

      <div className="grid grid-cols-3 gap-2.5">
        <Dato etiqueta={tr("Entrada")} valor={p.entradaHoy || "—"} icono={LogIn} />
        <Dato etiqueta={tr("Salida")} valor={p.salidaHoy || "—"} icono={LogOut} />
        <Dato etiqueta={tr("Días")} valor={String(p.mes.dias)} icono={CalendarDays} />
      </div>

      <Panel tono="honda">
        <h2 className="text-peq first-letter:uppercase">{tr("Mis horas · {mes}", { mes: monthLabel(currentMonth()) })}</h2>
        <p className="cifras mt-2 text-gigante font-light tracking-[-0.04em]">{fmtHoras(p.mes.trabajados)}</p>
        <p className="mt-1 text-base">{p.mes.extra > 0 ? tr("{horas} extra", { horas: fmtHoras(p.mes.extra) }) : tr("Total del mes")}</p>
      </Panel>

      {p.avance != null && (
        <section aria-label={tr("Avance de la obra")}>
          <FotoObra className="-mx-4 h-64 md:mx-0 md:h-72 md:rounded-panel" />
          <Panel tono="honda" vidrio className="relative -mt-16">
            <h2 className="text-peq">{tr("Avance de la obra")}</h2>
            <CifraAvance valor={p.avance} className="mt-2" />
          </Panel>
        </section>
      )}
    </div>
  );
}

export function InicioTrabajador() {
  const db = useDb();
  const { obraActual, jornadaHoras } = useObra();
  const { miembro } = useMiembro();

  const [deHoy, setDeHoy] = useState<Fichaje[]>([]);
  const [mes, setMes] = useState({ trabajados: 0, extra: 0, dias: 0 });
  const [avance, setAvance] = useState<number | null>(null);
  const [error, setError] = useState("");

  const trabajadorId = miembro?.trabajador_id ?? null;
  const obraId = obraActual?.id ?? null;

  const cargar = useCallback(async () => {
    if (obraId) {
      const { data } = await avanceObra(db, obraId);
      setAvance(typeof data === "number" ? data : null);
    }
    if (!trabajadorId) return;
    const { desde, hasta } = monthBounds(currentMonth());
    const [hoy, delMes] = await Promise.all([
      fichajesDeHoyDelTrabajador(db, trabajadorId, todayStr()),
      horasDelMesDeTrabajador(db, trabajadorId, desde, hasta),
    ]);
    const fallo = hoy.error ?? delMes.error;
    if (fallo) {
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar tus horas.") : fallo.message);
      return;
    }
    setError("");
    setDeHoy(hoy.data ?? []);
    const filas = delMes.data ?? [];
    const t = totalesFichajes(filas, jornadaHoras);
    // «Días» cuenta las filas del mes, también las que no tienen horas (pregunta abierta Q-06: se mantiene v1).
    setMes({ trabajados: t.trabajados, extra: t.extra, dias: filas.length });
  }, [db, obraId, trabajadorId, jornadaHoras]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // v2: Inicio también responde al gesto de recargar (DIS-15).
  useEnRefresco(cargar);

  if (!obraActual) return null;

  // v2 (DIS-05): con fichajes en varias obras el mismo día, v1 enseñaba uno
  // cualquiera. Ahora: el de la obra actual; si aquí no hay, el que tenga
  // entrada sin salida (sigue trabajando); si no, el primero con entrada.
  const fichajeHoy =
    deHoy.find((f) => f.obra_id === obraActual.id && f.hora_entrada) ??
    deHoy.find((f) => f.hora_entrada && !f.hora_salida) ??
    deHoy.find((f) => f.hora_entrada) ??
    null;

  return (
    <VistaInicioTrabajador
      obraNombre={obraActual.nombre}
      obraDireccion={obraActual.direccion}
      error={error}
      avance={avance}
      mes={mes}
      entradaHoy={fichajeHoy?.hora_entrada ?? null}
      salidaHoy={fichajeHoy?.hora_salida ?? null}
    />
  );
}
