# Cómo probarlo — Control de Obra v2 (Agente A)

Todo esto funciona **sin base de datos**: la app trae dentro un motor de datos en memoria con dos
empresas inventadas (correos `*.invalid`, importes falsos). No toca nada de producción.

## 1. Arrancar

```powershell
cd C:\Projects\apps\claude
npm install
npm run dev
```

Se abre en <http://localhost:3100>. El archivo `.env.local` ya trae lo necesario:

```
NEXT_PUBLIC_DATOS=memoria     # toda la app con datos de mentira
NEXT_PUBLIC_GALERIA=1         # abre /galeria/identidad
```

Para verlo **como se verá de verdad** (compilado, no en modo desarrollo — lección T-15):

```powershell
npm run build
npm start
```

## 2. Entrar

En `/login`, debajo del formulario, hay una lista de **cuentas de prueba**. Toca una y pulsa
«Увійти» / «Entrar». La contraseña ya va puesta (es `demo-obra-2026`, un valor falso de pruebas).

| Para ver… | Cuenta |
|---|---|
| Todo: corregir horas, dinero, ajustes, accesos | **Dueña** · `marta.salvia@reformas-salvia.invalid` |
| Lo mismo sin lo del dueño | Manager · `luis.ortega@reformas-salvia.invalid` |
| Solo su obra, sin «Dinero» | Jefa de obra · `raquel.vidal@reformas-salvia.invalid` |
| La pantalla de fichar de un obrero | **Trabajador** · `diego.navarro@reformas-salvia.invalid` |
| El aviso que sale antes de fichar la primera vez | Trabajadora · `irene.campos@reformas-salvia.invalid` |
| La pantalla de «esperando aprobación» | Pendiente · `pablo.reyes@reformas-salvia.invalid` |
| La pantalla de suscripción caducada | Dueña · `gloria.roble@carpinteria-roble.invalid` |
| Que una empresa no ve a la otra | Dueña · `ana.ejemplo@construcciones-ejemplo.invalid` |

Para volver a los datos de fábrica: botón **«Скинути дані демо»** al final de esa lista.

## 3. Qué mirar (en el móvil, que es donde se usa)

1. **Fichar en dos toques**: entra como trabajador → «Мої години сьогодні» → toca «Прихід».
   La hora que aparece es la que da el servidor, no la del móvil.
2. **Corregir horas**: entra como dueña → «Години» → «Виправити години» en alguien.
   Cambia las horas y guarda. Luego entra como ese trabajador: le sale «Усе правильно?» y «Підтверджую».
3. **El edificio**: en Inicio y en Planificación. Tiene tantas plantas levantadas como avance real
   tiene la obra; al 100 % se acristala y la grúa desaparece.
4. **El tema claro** (para el sol): Налаштування → Тема → «Світла (для сонця)».
5. **Los tres idiomas**: Налаштування → Мова → ES / UA / EN. Mira que no se corte ningún botón.
6. **Sin conexión**: en el navegador, F12 → Network → Offline, y toca «Прихід». El sello se pone
   negro con «Надсилаю…»; vuelve a poner Online y se envía solo.

## 4. Las comprobaciones automáticas

```powershell
node _pack/herramientas/correr-tests.mjs
```
Tienen que salir las 6 líneas en verde y `TODO CORRECTO` (horas, fechas, planificación, dinero,
lector de Excel y traducciones 537/537 en los dos idiomas).

```powershell
node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts
```
40 comprobaciones de las reglas de la base de datos imitadas (quién puede qué, los mensajes de
error exactos, que una empresa no vea a la otra…).

```powershell
npm run build   # tiene que terminar sin errores
npm run lint    # 0 errores (el sitio viejo tiene 4)
```
