# Concepto — Control de Obra v2 (Agente A)

## La idea, en una frase
**La obra se lee como se construye: sobre un plano color salvia, el avance sube en plantas de
hormigón y las horas y el dinero se cuentan en varillas, como la ferralla en espera.**

Referencia visual elegida por la dueña: «Construction Management App UI» (Dribbble), copiada lo más
fiel posible por decisión suya (DECISIONES D-02): lienzo salvia, acento lima, botón secundario casi
negro, etiquetas rectangulares tipo «On Track», barras verticales finas como gráfico, línea de tiempo
escalonada, barra de navegación flotante. Lo que **no** se copia: sus imágenes (los renders 3D son del
autor). Las nuestras se dibujan en código con los datos de la obra.

## Los tres momentos firma

| # | Momento | Qué ve el usuario | Por qué es nuestro |
|---|---|---|---|
| 1 | **El edificio que crece** (Inicio, Planificación, landing) | Un esqueleto de hormigón isométrico que tiene tantas plantas hechas como avance real tiene la obra (60,11 % → 4 de 7 plantas), con la última en marcha: pilares delanteros, esperas de ferralla y la grúa girando despacio. Al 100 % se acristala. | No es una ilustración de stock: es un gráfico de datos con forma de obra. Cambia cada día. |
| 2 | **Fichar** (Mis horas, cuadrilla) | Una losa lima del ancho del pulgar: «Marcar mi entrada». Al tocar, tres varillas laten («Enviando…»); al volver la respuesta, la **hora del servidor** cae como un sello en cifras grandes (07:58) y la varilla del día se levanta. Sin conexión, la losa se vuelve negra con una varilla lima que late: «guardado en el móvil». | Dos toques, dos segundos, una mano, al sol. El sello enseña la hora que manda (la del servidor, FIC-02). |
| 3 | **El dinero en varillas** (Dinero, Inicio) | El presupuesto como una regla de 48 varillas: blancas = gastado, lima = lo que queda, coral = lo que se pasa. Encima, el balance con signo explícito y la frase («La obra va en positivo»). | Se entiende de un vistazo sin leer un gráfico; el texto y el signo dicen lo mismo que el color. |

## Principios
1. **Una acción grande por pantalla de trabajador.** Lo demás, debajo y más pequeño.
2. **Al sol se lee.** Campos y botones con contraste AAA; el texto pequeño nunca es gris claro.
   Para pleno sol existe el tema «Claro» (D-06), con los mismos papeles de color.
3. **Los datos van en paneles hondos.** Dinero, horas y gráficos viven en salvia hondo con blanco
   (7,2:1): el ojo aprende que «lo oscuro es lo que importa».
4. **El color nunca va solo.** Cada estado lleva palabra o icono: «Retrasada», «Sin confirmar»,
   «Pagué yo», «Fichó fuera de la obra (a 420 m)».
5. **Las cifras son tabulares** y con signo explícito (+ / −).
6. **Nada se mueve de lado.** Todo cabe en 320 px; las pestañas se parten en líneas; el Gantt se
   dibuja en porcentajes del ancho (T-05/T-06/T-07).
7. **Estados diseñados, no sobrantes:** cargando (varillas que laten), vacío (varillas por levantar),
   error (coral con el mensaje del servidor tal cual), sin conexión (negro + lima), solo lectura
   (candado + motivo).

## Un sistema, dos públicos
- **Trabajador**: pantallas escasas, una losa por acción, cifras grandes, texto corto. Su barra de
  navegación lleva icono **y** palabra (solo 4 destinos).
- **Dueño / encargado**: las mismas piezas en versión densa — paneles hondos en rejilla, listas con
  importes alineados, varillas pequeñas. Barra de iconos (6 destinos) y barra lateral en el ordenador.
- La misma gramática para los dos: lienzo → panel → panel hondo; lima = «lo que hay que hacer»;
  coral = «atención»; negro = «secundario/seguro».
