import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Esta app es un dashboard cliente que carga datos de Supabase
      // según la obra/mes seleccionados (fetch-on-mount / on-dependency
      // -change en useEffect). Es el patrón correcto aquí — no hay
      // Server Components posibles porque los datos dependen de estado
      // del cliente (obra elegida, sesión) — así que se desactiva esta
      // regla, pensada para detectar fetches que deberían resolverse con
      // Server Components/Suspense en vez de con estado local.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Referencia de la app anterior (artifact), no se lintea ni se mantiene.
    "legacy/**",
    // v2: los scripts de Node usan require() a propósito (claves-i18n.js).
    "scripts/**",
    // v2: copia congelada de v1 y paquete del encargo, solo de consulta.
    "_ref-v1/**",
    "_pack/**",
  ]),
]);

export default eslintConfig;
