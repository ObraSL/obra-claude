# Identidad — tokens, letra, forma (Agente A)

Fuente de verdad: `app/globals.css` (tokens) · componentes en `components/ui/` y `components/marca/`.

## Marca (propuesta — decide la dueña, Q-05)
Tesela casi negra con tres varillas que suben (blanca, blanca, **lima**): ferralla, plantas, avance.
La última, en lima, es «lo que se está haciendo hoy». Nombre de trabajo sin cambios: «Control de Obra»
(Q-04), en Geist 600 con tracking −0,02 em. Archivo: `components/marca/Logo.tsx`.

## Color — dos temas, mismos papeles

| Papel | Salvia (por defecto) | Claro (sol) | Uso |
|---|---|---|---|
| lienzo `--c-fondo` | `#6b7867` | `#eef1ea` | fondo de pantalla |
| superficie `--c-sup` | `#5d6a59` | `#ffffff` | tarjetas, hojas |
| superficie honda `--c-sup-honda` | `#4b5848` | `#4b5848` | datos: dinero, horas, varillas, barra inferior |
| tinta `--c-tinta` | `#ffffff` | `#141613` | texto |
| tinta 2 `--c-tinta-2` | `#e6ebe2` (solo sobre superficies) | `#3d4739` | texto secundario |
| lima `--c-lima` | `#d5e09c` | `#d5e09c` | acción principal (relleno) |
| coral `--c-coral` | `#f0937c` | `#f0937c` | alerta (relleno con texto oscuro) |
| negro `--c-negro` | `#141613` | `#141613` | acción secundaria |
| campo `--c-campo` | `#f4f6f1` | `#f4f6f1` | campos de formulario (claros en los dos temas) |

### Contrastes medidos (WCAG 2.x; script `scratch/contraste.mjs`, fórmula de luminancia relativa)

| Par | Salvia | Claro | Nivel exigido |
|---|---|---|---|
| texto sobre lienzo | 4,66 | 15,95 | AA ✔ / AAA ✔ |
| texto sobre superficie | 5,72 | 18,20 | AA ✔ / AAA ✔ |
| texto secundario sobre superficie | 4,72 | 9,73 | AA ✔ |
| **blanco sobre panel hondo (cifras de dinero)** | **7,2** | **7,2** | **AAA ✔** |
| **casi negro sobre lima (botón fichar)** | **12,97** | **12,97** | **AAA ✔** |
| **blanco sobre negro (botón secundario)** | **18,20** | **18,20** | **AAA ✔** |
| casi negro sobre coral (errores, borrar) | 7,95 | 7,95 | AAA ✔ |
| lima sobre panel hondo (texto/gráfico) | 5,2 | 5,2 | AA ✔ |
| coral sobre panel hondo (varillas) | 3,24 | 3,24 | ≥ 3 gráficos ✔ |
| lima-texto sobre blanco | — | 7,32 | AAA ✔ |
| coral-texto sobre blanco | — | 5,35 | AA ✔ |

Reglas que salen de la tabla:
- En Salvia **el texto pequeño secundario solo va sobre superficies**, nunca sobre el lienzo (3,85).
- **El coral nunca es texto sobre salvia** (2,0–2,5): es relleno con texto oscuro, o varilla sobre panel hondo.
- Importes y horas importantes van en panel hondo (AAA) o en tamaño grande (AAA-grande ≥ 4,5).

## Letra
**Geist** variable (100–900), una sola familia, latín + cirílico, autoalojada con `next/font` (D-07).
Cifras con `tabular-nums` (clase `.cifras`). Escala de pocas tallas:

| Token | px | Uso |
|---|---|---|
| `text-gigante` | 56 / 1 | el sello de la hora, el avance |
| `text-cifra` | 40 / 1 | importes y totales grandes |
| `text-h1` | 26 / 32 | título de pantalla (uno por pantalla) |
| `text-titulo` | 20 / 25,6 | títulos de bloque y de hoja |
| `text-campo` | 17 / 24 | campos (evita el zoom de iOS) |
| `text-base` | 16 / 22,4 | texto y botones |
| `text-peq` | 14 / 20 | etiquetas, datos secundarios |
| `text-micro` | 12 / 16 | solo datos auxiliares, nunca acciones |

Pesos: 300 para cifras gigantes (como la referencia), 400 texto, 500 títulos y botones, 600 marca.
Probado en es/uk/en con los textos más largos (T-39), p. ej. «Повернутись до сьогодні» (×1,9).

## Forma
- Radios: botones y etiquetas **6 px**; paneles **14 px**; hojas **22 px** arriba.
- Sin sombras en reposo ni bordes: separación por **paso de tono** (lienzo → superficie → hondo).
- Objetivos táctiles: mínimo **44×44**; botones **48**; acciones de obra **60**.
- Barra inferior: cápsula flotante translúcida (como la referencia) con el activo en tesela honda.
- Iconos: `lucide-react` de trazo (ya era dependencia de v1), 20–22 px.

## Movimiento
Solo `transform` y `opacity`; duraciones 150 / 320 / 520 ms; curva `cubic-bezier(.2,.8,.2,1)`.
Momentos: plantas que suben, varillas que crecen, sello de la hora, hoja que sube. Con
`prefers-reduced-motion` todo aparece ya terminado.
