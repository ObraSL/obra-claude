"use client";

import { tr } from "@/lib/i18n";
import type { Tema } from "@/lib/tema";
import { Segmentos } from "@/components/ui/Controles";
import { SeccionAjustes } from "./SeccionListaActivable";

/** Cambio de tema (DECISIONES D-06), visible para todos los roles. Solo props; el contenedor usa useTema(). */
export function SelectorTema({ tema, onCambio }: { tema: Tema; onCambio: (t: Tema) => void }) {
  return (
    <SeccionAjustes titulo={tr("Tema")} testid="ajustes-tema">
      <Segmentos<Tema>
        etiqueta={tr("Tema")}
        valor={tema}
        onCambio={onCambio}
        opciones={[
          { valor: "salvia", texto: tr("Salvia") },
          { valor: "claro", texto: tr("Claro (para el sol)") },
        ]}
      />
    </SeccionAjustes>
  );
}
