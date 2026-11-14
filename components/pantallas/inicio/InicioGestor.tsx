"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, ReceiptText, Truck, Wallet } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useDb } from "@/lib/datos/provider";
import {
  cobrosImportes,
  contarFichadosHoy,
  fichajesUltimosDias,
  gastosHome,
  horasDelMesDeObra,
  tareasDeObra,
  usosVehiculoDelDiaDeObra,
} from "@/lib/datos/consultas";
import { useObra } from "@/lib/obra-context";
import { useMiembro } from "@/lib/miembro-context";
import type { PagadoPor, Tarea } from "@/lib/types";
import { currentMonth, shiftDay, todayStr } from "@/lib/format";
import { minutosTrabajados } from "@/lib/horas";
import { pagadoPorMi, suma } from "@/lib/dinero";
import { avanceObraExacto, estadoTarea, rangoObra } from "@/lib/gantt";
import { esFalloDeRed } from "@/lib/offline-fichajes";
import { useEnRefresco } from "@/components/shell/Refresco";
import { VistaInicioGestor } from "./VistaInicioGestor";

/** Días que se ven en el gráfico de varillas de la portada (HOM-03). */
const DIAS_GRAFICO = 14;

type GastoCorto = { importe: number; pagado_por: PagadoPor; fecha: string };

/** Inicio de dueño, manager y jefe de obra (HOM-01…HOM-07). */
export function InicioGestor() {
  const db = useDb();
  const { obraActual } = useObra();
  const { rol, modulos } = useMiembro();
  // Lo que paga el cliente (y por tanto el balance) no lo ve el jefe de obra.
  const veDinero = rol === "dueno" || rol === "manager";

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [fichadosHoy, setFichadosHoy] = useState<number | null>(null);
  const [cochesHoy, setCochesHoy] = useState<number | null>(null);
  const [gastos, setGastos] = useState<GastoCorto[]>([]);
  const [cobrado, setCobrado] = useState(0);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [horasDia, setHorasDia] = useState<number[]>(Array(DIAS_GRAFICO).fill(0));
  const [horasMes, setHorasMes] = useState(0);

  const hoy = todayStr();
  const obraId = obraActual?.id ?? null;

  const cargar = useCallback(async () => {
    if (!obraId) return;
    const desdeGrafico = shiftDay(hoy, -(DIAS_GRAFICO - 1));

    const [fichados, usos, gastosObra, cobros, plan, jornadas, delMes] = await Promise.all([
      contarFichadosHoy(db, obraId, hoy),
      usosVehiculoDelDiaDeObra(db, obraId, hoy),
      // Todos los gastos de la obra (con las facturas, que ya van dentro):
      // el total de la obra y, de ahí, lo del mes.
      gastosHome(db, obraId),
      veDinero ? cobrosImportes(db, obraId) : Promise.resolve({ data: [] as { importe: number }[], error: null }),
      tareasDeObra(db, obraId),
      // Horas fichadas de las últimas dos semanas: las varillas del gráfico.
      fichajesUltimosDias(db, obraId, desdeGrafico),
      // v2: «Horas del mes» suma el mes entero (v1 solo sumaba 14 días: DIS-01).
      horasDelMesDeObra(db, obraId, currentMonth()),
    ]);
    setCargando(false);

    const fallo = fichados.error ?? usos.error ?? gastosObra.error ?? cobros.error ?? plan.error ?? jornadas.error ?? delMes.error;
    if (fallo) {
      // v1 pintaba ceros como si fueran datos (DIS-13): aquí se dice que no se pudo cargar.
      setError(esFalloDeRed(fallo) ? tr("Sin conexión. No se han podido cargar los datos.") : fallo.message);
      return;
    }
    setError("");

    setFichadosHoy(fichados.count ?? 0);
    // Coches distintos que hoy han ido a esta obra (ya no se cuentan km).
    setCochesHoy(new Set((usos.data ?? []).map((u) => u.vehiculo_id)).size);
    setGastos(gastosObra.data ?? []);
    setCobrado(suma(cobros.data ?? []));
    setTareas(plan.data ?? []);

    const porDia = new Map<string, number>();
    for (const f of jornadas.data ?? []) {
      const min = minutosTrabajados(f.hora_entrada, f.hora_salida) ?? 0;
      porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + min);
    }
    const serie: number[] = [];
    for (let i = DIAS_GRAFICO - 1; i >= 0; i--) serie.push(porDia.get(shiftDay(hoy, -i)) ?? 0);
    setHorasDia(serie);
    setHorasMes((delMes.data ?? []).reduce((total, f) => total + (minutosTrabajados(f.hora_entrada, f.hora_salida) ?? 0), 0));
  }, [db, obraId, hoy, veDinero]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  // v2: Inicio también responde al gesto de recargar (en v1 no: DIS-15).
  useEnRefresco(cargar);

  if (!obraActual) return null;

  const avance = avanceObraExacto(tareas);
  const rango = rangoObra(tareas);
  const retrasadas = tareas.filter((t) => estadoTarea(t, hoy) === "retrasada").length;

  const mes = currentMonth();
  const gastosMes = gastos.filter((g) => g.fecha.slice(0, 7) === mes);
  const gastado = suma(gastos);
  // Balance de Inicio = cobrado − gastado (la pantalla Dinero suma además lo
  // recibido del jefe para esta obra: pregunta abierta Q-01, se mantiene v1).
  const balance = Math.round((cobrado - gastado) * 100) / 100;
  const presupuesto = suma(tareas.map((t) => ({ importe: t.presupuesto })));
  const pctPresupuesto = presupuesto > 0 ? Math.round((gastado / presupuesto) * 100) : 0;

  const accesos = [
    { href: "/fichajes", label: "Fichajes", icon: Clock3 },
    ...(modulos.vehiculos ? [{ href: "/vehiculos", label: "Vehículos", icon: Truck }] : []),
    { href: "/gastos", label: "Gastos", icon: ReceiptText },
    ...(veDinero ? [{ href: "/dinero", label: "Dinero", icon: Wallet }] : []),
  ];

  return (
    <VistaInicioGestor
      cargando={cargando}
      error={error}
      obraNombre={obraActual.nombre}
      obraDireccion={obraActual.direccion}
      veDinero={veDinero}
      moduloVehiculos={modulos.vehiculos}
      hoy={hoy}
      tareas={tareas}
      avance={avance}
      finPrevisto={rango?.hasta ?? null}
      retrasadas={retrasadas}
      horasDia={horasDia}
      horasMes={horasMes}
      fichadosHoy={fichadosHoy}
      cochesHoy={cochesHoy}
      cobrado={cobrado}
      gastado={gastado}
      balance={balance}
      gastadoMes={suma(gastosMes)}
      pagadoPorMiMes={pagadoPorMi(gastosMes)}
      presupuesto={presupuesto}
      pctPresupuesto={pctPresupuesto}
      accesos={accesos}
    />
  );
}
