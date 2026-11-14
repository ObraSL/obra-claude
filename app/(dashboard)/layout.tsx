import { DatosProvider } from "@/lib/datos/provider";
import { ObraProvider } from "@/lib/obra-context";
import { MiembroProvider } from "@/lib/miembro-context";
import { Cascaron } from "@/components/shell/Cascaron";
import { AccesoGate, AuthGate } from "@/components/puertas/Gates";

/** Panel: datos → sesión → cuenta → puertas (ACC-08) → obras → armazón. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatosProvider>
      <AuthGate>
        <MiembroProvider>
          <AccesoGate>
            <ObraProvider>
              <Cascaron>{children}</Cascaron>
            </ObraProvider>
          </AccesoGate>
        </MiembroProvider>
      </AuthGate>
    </DatosProvider>
  );
}
