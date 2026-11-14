# 00 - Inventario de la app v1 (Control de Obra)

Inventario propio de la v1 en el commit `4ed79ad`, hecho por el Agente A el 2026-11-14 a partir del código de `_ref-v1/` y de `_pack/ESPECIFICACION-ESTRUCTURA.md` (SPEC). Donde código y SPEC difieren, manda el código y se anota en la sección 6.
Los cuatro ficheros de área de `_inventario/` son los anexos detallados (textos exactos, estados, lecciones por línea):
[A - fichajes, inicio, shell](_inventario/A-fichajes-inicio-shell.md) · [B - gastos, dinero, vehículos, notas, planificación, resumen](_inventario/B-gastos-dinero-vehiculos-notas-plan-resumen.md) · [C - auth, alta, admin, ajustes](_inventario/C-auth-alta-admin-ajustes.md) · [D - base de datos](_inventario/D-base-de-datos.md).
Convenciones: `file:line` = línea del v1. Roles: `dueno`, `manager`, `jefe_obra` (los tres = "gestores"), `trabajador`. RLS = lo decide la BD, el cliente no filtra por empresa. Todos los textos de UI pasan por `tr()/trN()/trJsx()` (la clave es el texto en español) salvo los listados en la sección 6.

---

## 2. Rutas

| Ruta | Fichero | Quién abre | Qué muestra | SPEC |
|---|---|---|---|---|
| `/` | `app/(dashboard)/page.tsx` (+`components/landing/LandingMock.tsx`) | Anónimo: landing; con sesión: Home (gestor o trabajador) | Landing de una pantalla sin scroll / Home | ACC-01, HOM-* |
| `/login` | `app/login/page.tsx` | Anónimo (con sesión el proxy redirige a `/`) | Login / alta de cuenta / recuperar (`?empresa=`, `?alta=`) | ACC-02..05, 13 |
| `/reset-password` | `app/reset-password/page.tsx` | Enlace de email (no redirige con sesión) | Nueva contraseña | ACC-06 |
| `/alta`, `/alta/ok` | `app/alta/page.tsx`, `app/alta/ok/page.tsx` | Anónimo | Pago con tarjeta y código de alta | ONB-01, 02 |
| `/api/alta/checkout` (GET, POST), `/api/alta/codigo` (GET) | `app/api/alta/{checkout,codigo}/route.ts` | Público | Precio, sesión Stripe, código de alta | ONB-01, 02, 04 |
| `/api/stripe/webhook` (POST) | `app/api/stripe/webhook/route.ts` | Público (firma Stripe obligatoria) | Alta/renovación de suscripción | ONB-03 |
| `/fichajes` | `app/(dashboard)/fichajes/page.tsx` | Todos aprobados | Gestores: cuadrilla; trabajador: `MiFichaje` | FIC-* |
| `/vehiculos` | `app/(dashboard)/vehiculos/page.tsx` | Todos aprobados, módulo `vehiculos` ON | Uso de vehículos por día (trabajador: solo lectura) | VEH-01..04 |
| `/gastos` | `app/(dashboard)/gastos/page.tsx` | Gestores (trabajador redirigido a `/`) | Gastos y facturas en una lista | GAS-01..08 |
| `/facturas` | `app/(dashboard)/facturas/page.tsx` | - | `redirect("/gastos")` | §2 |
| `/dinero` | `app/(dashboard)/dinero/page.tsx` | `dueno`, `manager`; `jefe_obra` ve "Solo para el dueño y el manager" | Cobros, dinero del jefe, balance | DIN-01..05 |
| `/notas` | `app/(dashboard)/notas/page.tsx` | Gestores + módulo `notas_voz` ON | Nota de voz por obra y día | NOT-01..04 |
| `/planificacion` | `app/(dashboard)/planificacion/page.tsx` | Gestores | Gantt, tareas, import Excel | PLA-01..06 |
| `/resumen` | `app/(dashboard)/resumen/page.tsx` | Gestores | Resumen mensual + export Excel | RES-01..05 |
| `/ajustes` | `app/(dashboard)/ajustes/page.tsx` | Todos aprobados | Variante gestor (por rol) / variante trabajador | AJU-* |
| `/admin` | `app/admin/layout.tsx`, `app/admin/page.tsx` | Solo admin de plataforma (cuenta aparte, sin providers del dashboard) | Empresas, códigos de alta, errores | ADM-01..04, §15 |
| `/plantilla-plan-obra.xlsx` | `public/` | Público (en `PUBLIC_PATHS` del proxy) | Plantilla descargable del plan | PLA-05 |
| `/manifest.webmanifest`, `/sw.js`, `/icons/*` | `public/sw.js` (manifest e iconos no inventariados) | Público | PWA | PLT-02 |
| (sin ruta) | `app/error.tsx`, `app/global-error.tsx` | - | Pantallas de error | PLT-03 |

Bloqueo por rol: `AccesoGate` (`components/layout/AccesoGate.tsx:20-27`) solo redirige al trabajador desde `RUTAS_SOLO_GESTORES = /gastos /facturas /notas /resumen /planificacion /dinero` y a toda ruta con módulo apagado (`/vehiculos`->`vehiculos`, `/notas`->`notas_voz`). `caja_jefe` no bloquea ruta. Admin de plataforma: `router.replace("/admin")`. El proxy (`proxy.ts` + `lib/supabase/middleware.ts`) redirige a `/login` si no hay sesión y no es pública (`/`, `/login`, `/reset-password`, `/alta`, `/api/alta`, `/api/stripe`, `/plantilla-plan-obra.xlsx`).
Cadena de montaje (`app/(dashboard)/layout.tsx:9-17`): `AuthGate` -> `MiembroProvider` -> `AccesoGate` -> `ObraProvider` -> `DashboardShell` -> página. Orden de gates: spinner -> `PendienteAprobacion` -> `SuscripcionInactiva` -> `AvisoControl` (solo trabajador) -> contenido.

---

## 3. Pantallas y componentes

### 3.1 Shell y gates
| Componente | Rol / quién | Llamadas de datos principales | SPEC |
|---|---|---|---|
| `AuthGate` | Sin sesión: `LandingMock` | `getSession` | ACC-01, ACC-08 |
| `MiembroProvider` (`lib/miembro-context.tsx`) | Todos | `miembros` por `user_id`, `soy_admin_plataforma`, `empresas`, `ajustes`; escribe `guardarModulo`, `guardarMiNombre` | ACC-08, §1 |
| `AccesoGate` | Todos | (ninguna propia) | ACC-08, ACC-11 |
| `ObraProvider` (`lib/obra-context.tsx`) | Todos | `obras` (todas), `ajustes` jornada/jefe; `crearObra`, `toggleObraActiva`; localStorage obra | SHL-05, AJU-04/05 |
| `DashboardShell`, `Sidebar` (>=768 px), `BottomNav` (móvil, solo iconos), `lib/nav.ts` | Items por rol/módulo | `signOut` | SHL-01, 02, 06, 08, ACC-14 |
| `TopBar`, `ObraPicker` | Selector de obra; "Nueva obra" para todos los roles | `crearObra` | SHL-03, 04 |
| `SinObras` (gestores), `SinObrasAsignadas` (trabajador) | Sin obras | `crearObra` | SHL-06 |
| `PullToRefresh` (+`useEnRefresco`) | Emite `obra:refrescar` (arrastre > 140 px) | (ninguna) | SHL-07 |
| `PendienteAprobacion` | Cuenta no aprobada | `guardar_mi_nombre`, refrescar miembro | ACC-09 |
| `SuscripcionInactiva` | Empresa bloqueada/caducada | (ninguna) | ACC-10 |
| `AvisoControl` | Trabajador, versión `2026-09-28` | `confirmar_aviso_control`, `obtenerPosicion` | ACC-11 |
| `LandingMock` | Anónimo; datos fijos | (ninguna) | ACC-01 |
| `ui/`: `StampButton`, `DayNav`, `Sheet`, `BarrasProgreso`, `Sparkline`, `NumeroGrande`, `Card/StatCard/HeroStatCard`, `Button*`, `Field/Input/Select`, `Empty`, `Logo`, `SelectorIdioma` | Primitivas | (ninguna) | SHL-*, Q-05 |
| `ServiceWorkerRegister`, `public/sw.js`, `error.tsx`, `global-error.tsx`, `instrumentation*.ts`, `lib/errores.ts` | PWA y errores | `registrar_error` | PLT-01..04 |

### 3.2 Home (`app/(dashboard)/page.tsx`)
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `InicioGestor` | dueno/manager (cobrado/balance), jefe_obra (sin dinero) | 6 consultas: fichajes (count hoy), usos_vehiculo hoy, gastos de obra, cobros (solo dueno/manager), tareas, fichajes 14 días | HOM-01..07 |
| `MiniGantt`, `BarrasProgreso`, `NumeroGrande` | - | (props) | HOM-02, 04 |
| `InicioTrabajador` | trabajador | fichaje de hoy, horas del mes, `avance_obra` | HOM-W1..W5 |

### 3.3 Fichajes
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `FichajesCuadrilla` | Gestores; "Corregir horas" solo dueno | trabajadores activos, fichajes del día (obra y otras obras), upserts de fichaje, mover obra, añadir trabajador | FIC-10..16, 20..24 |
| `CorregirHorasForm` | dueno | historial del fichaje, `corregirHoras`, `quitarDia`, `moverFichajeDeObra` | FIC-20..24 |
| `MiFichaje` | trabajador | fichaje del día, horas del mes (todas las obras), upserts con geovalla, zona, transporte, confirmo | FIC-30..38 |
| `TransporteSelector` | trabajador (módulo `transporte`) | (callback a `guardar`) | FIC-37 |
| `lib/offline-fichajes.ts`, `lib/horas.ts`, `lib/geo.ts` | Cola local, cálculo, GPS | upsert de reintento | FIC-03, 07, 08 |

### 3.4 Gastos
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `GastosPage` (+`DetalleGasto`, `GastoForm`) | Gestores; "¿Quién lo pagó?" y cambiar/borrar "personal" solo dueno | gastos de obra, proveedores, insert/update/delete, subida a `facturas` | GAS-01..08 |
| `ProveedorSelector` | Gestores | (props; el padre llama `asegurarProveedor`) | GAS-06 |
| `SelectorArchivo`, `ArchivoViewer`, `lib/image.ts` | Gestores | upload `facturas` (JPEG<=1600 px ancho, PDF<=10 MB), URL firmada 600 s | GAS-05, 07 |
| `PagadoPor*`, `MonthFilter` | - | (props) | GAS-03, 05 |

### 3.5 Dinero
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `DineroPage` / `Dinero` | dueno, manager; "Mi caja", pestaña "Del jefe" solo dueno + `caja_jefe` | cobros, gastos (importe/pagado_por), tareas.presupuesto; dueno: entregas y gastos personales de todas las obras | DIN-01..03 |
| `CobroForm`, `DetalleCobro` | dueno, manager | insert/delete cobro, upload `facturas/cobros` | DIN-04 |
| `EntregaForm`, `FilaEntrega` | dueno | insert/delete entrega | DIN-03 |

### 3.6 Vehículos
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `VehiculosPage` | Todos; "Añadir vehículo" para todo salvo trabajador | vehículos activos, trabajadores activos, usos del día (todas las obras) | VEH-01..04 |
| `DiaDelVehiculo`, `UsoForm` | No trabajador (editable) | insert/update/delete uso (`23505` -> "Ese coche ya está apuntado en esa obra este día.") | VEH-02, 03 |
| `DiaDelVehiculoSoloVer` | trabajador | (lectura) | VEH-04 |

### 3.7 Notas de voz
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `NotasPage` | Gestores + módulo | nota del día, últimas 12, URL firmada 3600 s, upload `notas`, upsert, delete | NOT-01..04 |
| `GrabadorAudio` | Gestores | `MediaRecorder` (webm/mp4/aac/ogg según soporte) | NOT-01 |

### 3.8 Planificación
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `PlanificacionPage` | Gestores | tareas de obra; insert/update/delete; import | PLA-01, 02, 06 |
| `Gantt` / `MiniGantt` / `lib/gantt.ts` | - | (puro) | PLA-03 |
| `TareaForm` | Gestores | (callbacks) | PLA-04 |
| `ImportarExcel` + `lib/importar-excel.ts` (carga perezosa, `xlsx`) | Gestores | `borrarTareasDeObra` + insert masivo | PLA-05 |

### 3.9 Resumen
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `ResumenPage`, `ResumenTrabajadores`, `ResumenVehiculos`, `ResumenGastos` + sheets de detalle | Gestores | trabajadores, vehículos, fichajes/usos/gastos/historial del mes; detalle por trabajador/vehículo (todas las obras) | RES-01..05 |
| `lib/exportar-excel.ts` (`exportarResumenObra`, hojas Horas, Gastos, Vehículos, Correcciones) | Gestores | (usa lo ya cargado) | RES-02 |

### 3.10 Ajustes
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `AjustesPage` -> `AjustesGestor` | Idioma: todos; Accesos, Soporte, Jornada, Jefe, Módulos: dueno; Obras, Trabajadores, Vehículos: dueno+manager; jefe_obra: solo Idioma + salir | trabajadores, vehículos (todos), upserts de `ajustes` | AJU-01, 04..07, 09 |
| `Accesos` | dueno | miembros, trabajadores, `empresas.codigo`; update/delete miembro; crear ficha | AJU-02 |
| `SoporteAcceso` | dueno | `soporte_accesos`, `dar_acceso_soporte`, `revocar_acceso_soporte` | AJU-03 |
| `ConfigurarObra` | dueno | `obras.update` (lat/lng/radio/hora/minutos) | AJU-07 |
| `EliminarObra` + `lib/eliminar-obra.ts` | dueno | reautenticación, rutas de archivos, `remove` en storage, `eliminar_obra` | AJU-08 |
| `AjustesTrabajador` | trabajador | (contexto) | AJU-W1 |

### 3.11 Admin
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `admin/layout.tsx` | Admin de plataforma | `getSession`, `soy_admin_plataforma` | §15, ACC-14 |
| `admin/page.tsx` | Admin de plataforma | 3 listados RPC; crear/cancelar código; `establecer_suscripcion`; borrar errores | ADM-01..04 |

### 3.12 Alta y login
| Componente | Rol | Llamadas | SPEC |
|---|---|---|---|
| `login/page.tsx` | Anónimo; modos login/signup/recuperar | `comprobar_codigo_registro` (debounce 400 ms), `signInWithPassword`, `signUp`, `resetPasswordForEmail`; localStorage email | ACC-02..05, 13 |
| `reset-password/page.tsx` | Enlace de email | `updateUser({password})` | ACC-06 |
| `alta/page.tsx` | Anónimo | GET y POST `/api/alta/checkout` | ONB-01 |
| `alta/ok/page.tsx` | Anónimo | GET `/api/alta/codigo?session_id` (sin reintentos) | ONB-02 |
| `lib/pagos.ts` (`getStripe`, `adminDb`, `pagadoHasta`, `codigoDePago`, `DIAS_MARGEN=3`) | Servidor | Stripe + RPC `registrar_pago_alta`, `actualizar_pago_suscripcion` | ONB-03, 04 |
| `lib/i18n/*` | Todos | cookie `idioma` | PLT-01 |

---

## 4. Llamadas de datos (consolidado y sin duplicados)

Cliente Supabase del navegador salvo indicación. Alcance por empresa decidido por RLS. `monthBounds(mes)` = `{desde:"YYYY-MM-01", hasta:"<mes siguiente>-01"}` (siempre `gte/lt`). Fechas = `"YYYY-MM-DD"`. Upserts de fichajes: `{onConflict:"obra_id,trabajador_id,fecha"}` + `.select().single()`.

| # | Función | Llamada exacta | Usada en |
|---|---|---|---|
| | **Sesión y miembro** | | |
| 1 | `obtenerSesion` / `suscribirSesion` | `auth.getSession()` + `auth.onAuthStateChange(cb)` | useSession, AuthGate, admin layout, PendienteAprobacion |
| 2 | `obtenerUsuario` | `auth.getUser()` | MiembroProvider, `owner_id` en inserts/upserts, EliminarObra, proxy |
| 3 | `cerrarSesion` | `auth.signOut()` | Sidebar, gates, Ajustes, admin |
| 4 | `leerMiMiembro(userId)` | `from('miembros').select('*').eq('user_id',userId).maybeSingle()` | MiembroProvider |
| 5 | `listarMiembros` | `from('miembros').select('*').order('created_at',{ascending:true})` | Accesos |
| 6 | `actualizarMiembro(userId,cambios)` | `from('miembros').update(cambios).eq('user_id',userId).select().single()` (cambios: `{rol,obra_id?:null}`, `{obra_id}`, `{trabajador_id}`, `{aprobado}`) | Accesos |
| 7 | `eliminarMiembro(userId)` | `from('miembros').delete().eq('user_id',userId)` | Accesos |
| 8 | `soyAdminPlataforma` | `rpc('soy_admin_plataforma')` (truthy = admin) | MiembroProvider, admin layout |
| 9 | `leerEstadoSuscripcion` | `from('empresas').select('activa_hasta, bloqueada').maybeSingle()` | MiembroProvider |
| 10 | `leerCodigoEmpresa` | `from('empresas').select('codigo').limit(1).maybeSingle()` | Accesos |
| 11 | `guardarMiNombre(nombre)` | `rpc('guardar_mi_nombre',{nuevo:nombre})` | PendienteAprobacion |
| 12 | `confirmarAvisoControl(version)` | `rpc('confirmar_aviso_control',{version})` (versión `"2026-09-28"`, sin prefijo `p_`) | AvisoControl |
| | **Ajustes y soporte** | | |
| 13 | `leerAjustes` | `from('ajustes').select('*').limit(1).maybeSingle()` (`mod_vehiculos\|notas_voz\|caja_jefe\|transporte\|geolocalizacion`; sin fila = todo ON) | MiembroProvider |
| 14 | `leerAjustesJornada` | `from('ajustes').select('jornada_horas,jefe_ve_todas').maybeSingle()` | ObraProvider |
| 15 | `guardarJornada(horas)` | `from('ajustes').upsert({owner_id:user.id,jornada_horas:horas,updated_at:ISO})` | Ajustes |
| 16 | `guardarJefeVeTodas(valor)` | `from('ajustes').upsert({owner_id:user.id,jefe_ve_todas:valor,updated_at:ISO})` | Ajustes |
| 17 | `guardarModulo(clave,valor)` | `from('ajustes').upsert({owner_id:user.id,['mod_'+clave]:valor,updated_at:ISO})` | Ajustes |
| 18 | `listarAccesosSoporte` | `from('soporte_accesos').select('*').order('otorgado_en',{ascending:false})` | SoporteAcceso |
| 19 | `darAccesoSoporte(email,horas)` | `rpc('dar_acceso_soporte',{email_soporte,horas})` (sin `p_`; error crudo al usuario) | SoporteAcceso |
| 20 | `revocarAccesoSoporte(id)` | `rpc('revocar_acceso_soporte',{acceso_id:id})` | SoporteAcceso |
| | **Obras** | | |
| 21 | `listarObras` | `from('obras').select('*').order('created_at',{ascending:false})` (incluye cerradas) | ObraProvider |
| 22 | `crearObra(nombre,direccion)` | `from('obras').insert({owner_id:user.id,nombre,direccion:direccion\|\|null,activa:true}).select().single()` | ObraPicker, SinObras, Ajustes |
| 23 | `cambiarActivaObra(id,activa)` | `from('obras').update({activa}).eq('id',id).select().single()` (v1 invierte `!obra.activa`) | Ajustes |
| 24 | `guardarUbicacionHorarioObra(id,d)` | `from('obras').update({lat,lng,radio_metros:Number(radio)\|\|150,hora_inicio_turno:hora\|\|null,minutos_antes_permitidos:Number(min)\|\|0}).eq('id',id).select().single()` | ConfigurarObra |
| 25 | `avanceObra(obraId)` | `rpc('avance_obra',{o_id:obraId})` (numeric; el v1 solo lo muestra si `typeof === "number"`) | InicioTrabajador |
| 26 | `archivosDeObra(obraId)` | `gastos.select('recibo_path').eq('obra_id').not('recibo_path','is',null)` + `cobros.select('archivo_path').eq('obra_id').not('archivo_path','is',null)` + `notas_audio.select('audio_path').eq('obra_id')` | EliminarObra |
| 27 | `eliminarObraRpc(obraId)` | `rpc('eliminar_obra',{p_obra_id})` -> `error.message \| null` (antes: `borrarArchivo` de los paths del #26) | EliminarObra |
| | **Trabajadores** | | |
| 28 | `trabajadoresActivos` | `from('trabajadores').select('*').eq('activo',true).order('nombre')` | Fichajes cuadrilla, Vehículos |
| 29 | `trabajadoresTodos` | `from('trabajadores').select('*').order('nombre')` | Resumen, Ajustes, Accesos |
| 30 | `crearTrabajador(nombre)` | `from('trabajadores').insert({owner_id:user.id,nombre}).select().single()` | Fichajes, Ajustes, Accesos (crear ficha) |
| 31 | `cambiarActivoTrabajador(id,activo)` | `from('trabajadores').update({activo}).eq('id',id).select().single()` | Ajustes |
| | **Fichajes: lectura** | | |
| 32 | `fichajesDelDia(obraId,fecha)` | `from('fichajes').select('*').eq('obra_id',obraId).eq('fecha',fecha)` | Fichajes cuadrilla |
| 33 | `fichajesDelDiaOtrasObras(obraId,fecha)` | `from('fichajes').select('*').neq('obra_id',obraId).eq('fecha',fecha)` | Fichajes cuadrilla |
| 34 | `miFichajeDelDia(obraId,trabajadorId,fecha)` | `from('fichajes').select('*').eq('obra_id').eq('trabajador_id').eq('fecha').maybeSingle()` | MiFichaje, reconciliación offline |
| 35 | `fichajeDeHoyDeTrabajador(trabajadorId,fecha)` | `from('fichajes').select('*').eq('trabajador_id').eq('fecha').limit(1)` (sin filtro de obra) | InicioTrabajador |
| 36 | `horasDelMesDeTrabajador(trabajadorId,desde,hasta)` | `from('fichajes').select('hora_entrada,hora_salida').eq('trabajador_id').gte('fecha',desde).lt('fecha',hasta)` (todas las obras) | MiFichaje, InicioTrabajador |
| 37 | `contarFichadosHoy(obraId,fecha)` | `from('fichajes').select('id',{count:'exact',head:true}).eq('obra_id').eq('fecha',fecha).not('hora_entrada','is',null)` | InicioGestor |
| 38 | `fichajesUltimosDias(obraId,desde)` | `from('fichajes').select('fecha,hora_entrada,hora_salida').eq('obra_id').gte('fecha',desde)` (desde=hoy-13, sin tope) | InicioGestor |
| 39 | `fichajesDeObraEnMes(obraId,mes)` | `from('fichajes').select('*').eq('obra_id').gte('fecha',desde).lt('fecha',hasta)` | Resumen |
| 40 | `fichajesDeTrabajadorEnMes(trabajadorId,mes)` | `from('fichajes').select('*').eq('trabajador_id').gte('fecha',desde).lt('fecha',hasta).order('fecha')` (todas las obras) | Resumen (detalle) |
| 41 | `historialFichaje(fichajeId)` | `from('fichajes_historial').select('*').eq('fichaje_id',fichajeId).order('cambiado_en',{ascending:false})` | CorregirHorasForm |
| 42 | `historialDeObraEnMes(obraId,mes)` | `from('fichajes_historial').select('*').eq('obra_id').gte('fecha',desde).lt('fecha',hasta)` (sin order) | Resumen |
| | **Fichajes: escritura** | | |
| 43 | `ficharCampo(obra,trab,fecha,campo,hora)` | `upsert({obra_id,trabajador_id,fecha,[campo]:hora})` (`campo`=`hora_entrada\|hora_salida`) | Cuadrilla |
| 44 | `ficharConGeovalla(...,ubicacionOk\|null,distancia\|null)` | `upsert({obra_id,trabajador_id,fecha,[campo]:hora,ubicacion_ok,distancia_metros})` (ambas siempre presentes) | MiFichaje |
| 45 | `reintentarFichajePendiente(item)` | `upsert({obra_id,trabajador_id,fecha,[campo]:hora,...(ubicacion_ok si definido),...(distancia_metros si definido)})`; si error `/ya está fichad/i` -> `miFichajeDelDia` (#34) | offline-fichajes |
| 46 | `corregirHoras(obra,trab,fecha,entrada\|null,salida\|null)` | `upsert({obra_id,trabajador_id,fecha,hora_entrada,hora_salida,hora_corregida:true})` (`quitarDia` = `null,null`) | CorregirHorasForm |
| 47 | `moverFichajeDeObra(fichajeId,nuevaObraId)` | `from('fichajes').update({obra_id:nuevaObraId}).eq('id',fichajeId).select().single()` | CorregirHorasForm |
| 48 | `guardarZonaFichaje(...,ubicacion)` | `upsert({obra_id,trabajador_id,fecha,ubicacion})` | Cuadrilla, MiFichaje |
| 49 | `guardarTransporte(...,transporte,traidoPor\|null)` | `upsert({obra_id,trabajador_id,fecha,transporte,traido_por})` (`propio\|traido`) | MiFichaje |
| 50 | `confirmarHorasCorregidas(...)` | `upsert({obra_id,trabajador_id,fecha,confirmado_trabajador:true})` | MiFichaje |
| | **Vehículos** | | |
| 51 | `vehiculosActivos` | `from('vehiculos').select('*').eq('activo',true).order('nombre')` | Vehículos |
| 52 | `vehiculosTodos` | `from('vehiculos').select('*').order('nombre')` | Resumen, Ajustes |
| 53 | `crearVehiculo(nombre)` | `from('vehiculos').insert({owner_id:user.id,nombre}).select().single()` | Vehículos, Ajustes |
| 54 | `cambiarActivoVehiculo(id,activo)` | `from('vehiculos').update({activo}).eq('id',id).select().single()` | Ajustes |
| 55 | `usosVehiculoDelDia(fecha)` | `from('usos_vehiculo').select('*').eq('fecha',fecha).order('created_at')` (todas las obras) | Vehículos |
| 56 | `usosVehiculoDelDiaDeObra(obraId,fecha)` | `from('usos_vehiculo').select('vehiculo_id').eq('obra_id').eq('fecha',fecha)` | InicioGestor |
| 57 | `usosVehiculoDeObraEnMes(obraId,mes)` | `from('usos_vehiculo').select('*').eq('obra_id').gte('fecha',desde).lt('fecha',hasta)` | Resumen |
| 58 | `usosDeVehiculoEnMes(vehiculoId,mes)` | `from('usos_vehiculo').select('*').eq('vehiculo_id').gte('fecha',desde).lt('fecha',hasta).order('fecha')` | Resumen (detalle) |
| 59 | `crearUsoVehiculo(d)` | `from('usos_vehiculo').insert({vehiculo_id,fecha,obra_id,conductor_id\|null,destino\|null})` (`23505` -> "Ese coche ya está apuntado en esa obra este día.") | Vehículos |
| 60 | `actualizarUsoVehiculo(id,d)` | `from('usos_vehiculo').update({obra_id,conductor_id,destino}).eq('id',id)` | Vehículos |
| 61 | `borrarUsoVehiculo(id)` | `from('usos_vehiculo').delete().eq('id',id)` | Vehículos |
| | **Gastos y proveedores** | | |
| 62 | `gastosDeObra(obraId)` | `from('gastos').select('*').eq('obra_id').order('fecha',{ascending:false}).order('created_at',{ascending:false})` | Gastos |
| 63 | `gastosDeObraEnMes(obraId,mes)` | `from('gastos').select('*').eq('obra_id').gte('fecha',desde).lt('fecha',hasta)` | Resumen |
| 64 | `gastosHome(obraId)` | `from('gastos').select('importe,pagado_por,fecha').eq('obra_id')` | InicioGestor |
| 65 | `gastosDinero(obraId)` | `from('gastos').select('importe,pagado_por,obra_id').eq('obra_id')` | Dinero |
| 66 | `gastosPagadosPorMi` | `from('gastos').select('importe,pagado_por,obra_id').eq('pagado_por','personal')` (todas las obras; solo dueno) | Dinero |
| 67 | `crearGasto(d)` | `from('gastos').insert({obra_id,concepto,proveedor,importe,categoria,fecha,recibo_path,recibo_tipo,pagado_por}).select().single()` | Gastos |
| 68 | `actualizarGasto(id,d)` | `from('gastos').update(d).eq('id',id).select().single()` | Gastos |
| 69 | `borrarGasto(id)` | `from('gastos').delete().eq('id',id)` (BD primero; luego `borrarArchivo` salvo `factura_origen_id`) | Gastos |
| 70 | `proveedores` | `from('proveedores').select('*').order('nombre')` | Gastos |
| 71 | `crearProveedor(nombre,favorito)` | `from('proveedores').insert({nombre,favorito})` | Gastos |
| 72 | `marcarProveedorFavorito(id,favorito)` | `from('proveedores').update({favorito}).eq('id',id)` | Gastos |
| | **Cobros y entregas** | | |
| 73 | `cobrosDeObra(obraId)` | `from('cobros').select('*').eq('obra_id').order('fecha',{ascending:false})` | Dinero |
| 74 | `cobrosImportes(obraId)` | `from('cobros').select('importe').eq('obra_id')` (solo dueno/manager) | InicioGestor |
| 75 | `crearCobro(d)` | `from('cobros').insert({obra_id,importe,fecha,concepto\|null,archivo_path,archivo_tipo})` | Dinero |
| 76 | `borrarCobro(id)` | `from('cobros').delete().eq('id',id)` (v1 borra antes el archivo) | Dinero |
| 77 | `entregas` | `from('entregas').select('*').order('fecha',{ascending:false})` (todas las obras; solo dueno) | Dinero |
| 78 | `crearEntrega(d)` | `from('entregas').insert({owner_id:miembro.user_id,importe,fecha,concepto\|null,obra_id\|null})` | Dinero |
| 79 | `borrarEntrega(id)` | `from('entregas').delete().eq('id',id)` | Dinero |
| | **Tareas** | | |
| 80 | `tareasDeObra(obraId)` | `from('tareas').select('*').eq('obra_id').order('orden').order('fecha_inicio')` | Home, Planificación |
| 81 | `presupuestosTareas(obraId)` | `from('tareas').select('presupuesto').eq('obra_id')` | Dinero |
| 82 | `crearTarea(d)` | `from('tareas').insert({obra_id,nombre,fecha_inicio,fecha_fin,avance,presupuesto,orden})` (orden = max+1 o 0) | Planificación |
| 83 | `actualizarTarea(id,d)` | `from('tareas').update({nombre,fecha_inicio,fecha_fin,avance,presupuesto}).eq('id',id)` | Planificación |
| 84 | `borrarTarea(id)` | `from('tareas').delete().eq('id',id)` | Planificación |
| 85 | `borrarTareasDeObra(obraId)` | `from('tareas').delete().eq('obra_id',obraId)` | Import Excel |
| 86 | `crearTareas(filas[])` | `from('tareas').insert([{obra_id,nombre,fecha_inicio,fecha_fin,avance:0,orden,presupuesto},...])` (lote; v1 no atómico con #85) | Import Excel |
| | **Notas de voz** | | |
| 87 | `notaDelDia(obraId,fecha)` | `from('notas_audio').select('*').eq('obra_id').eq('fecha').maybeSingle()` | Notas |
| 88 | `ultimasNotas(obraId)` | `from('notas_audio').select('*').eq('obra_id').order('fecha',{ascending:false}).limit(12)` | Notas |
| 89 | `guardarNota(d)` | `from('notas_audio').upsert({obra_id,fecha,audio_path,duracion_seg},{onConflict:'obra_id,fecha'})` | Notas |
| 90 | `borrarNota(id)` | `from('notas_audio').delete().eq('id',id)` (v1 borra antes el audio) | Notas |
| | **Storage** | | |
| 91 | `subirArchivo(obraId,carpeta,archivo)` | `storage.from('facturas').upload(`${obraId}/${carpeta}/${uuid}.${pdf\|jpg}`,blob,{contentType})`, sin `upsert`; carpeta `gastos\|cobros`; el primer segmento DEBE ser el id de obra | Gastos, Dinero |
| 92 | `subirAudio(obraId,blob,ext)` | `storage.from('notas').upload(`${obraId}/${uuid}.${ext}`,blob,{contentType:blob.type\|\|undefined})` | Notas |
| 93 | `urlFirmada(bucket,path,seg)` | `storage.from(bucket).createSignedUrl(path,seg)` (`facturas`/600, `notas`/3600) | ArchivoViewer, Notas |
| 94 | `borrarArchivo(bucket,path)` | `storage.from(bucket).remove([path])` (no si el gasto tiene `factura_origen_id`) | Gastos, Dinero, Notas, EliminarObra |
| | **Auth y registro** | | |
| 95 | `iniciarSesion(email,password)` | `auth.signInWithPassword({email,password})` (también reautenticación en EliminarObra) | Login, EliminarObra |
| 96 | `registrarse(email,password,meta)` | `auth.signUp({email,password,options:{emailRedirectTo:`${origin}/login`,data:meta}})`; meta = `{empresa_codigo,nombre,apellidos}` o `{codigo_alta,nombre_empresa,nombre,apellidos}` | Login |
| 97 | `enviarEnlaceRecuperacion(email)` | `auth.resetPasswordForEmail(email,{redirectTo:`${origin}/reset-password`})` | Login |
| 98 | `cambiarPassword(password)` | `auth.updateUser({password})` (la UI comprueba `message.includes("session")`) | Reset |
| 99 | `comprobarCodigoRegistro(codigo)` | `rpc('comprobar_codigo_registro',{p_codigo:codigo.trim()})` -> `{tipo:'empresa'\|'alta',nombre}[]`; se usa la fila 0; sin fila o error = inválido | Login |
| 100 | `registrarError(...)` | `rpc('registrar_error',{p_origen,p_mensaje,p_detalle,p_ruta,p_navegador})` (cliente, fire-and-forget); servidor: `fetch POST {SUPABASE_URL}/rest/v1/rpc/registrar_error` con la anon key, timeout 3 s | errores.ts, instrumentation*.ts, error.tsx |
| | **Admin** | | |
| 101 | `listarEmpresasAdmin` | `rpc('listar_empresas_admin')` | Admin |
| 102 | `listarCodigosAlta` | `rpc('listar_codigos_alta')` | Admin |
| 103 | `listarErroresAdmin(limite=100)` | `rpc('listar_errores_admin',{p_limite:100})` | Admin |
| 104 | `crearCodigoAlta(nota)` | `rpc('crear_codigo_alta',{p_nota:nota})` -> código | Admin |
| 105 | `cancelarCodigoAlta(id)` | `rpc('cancelar_codigo_alta',{p_id:id})` | Admin |
| 106 | `establecerSuscripcion(empresaId,hasta\|null,bloqueada)` | `rpc('establecer_suscripcion',{p_empresa,p_activa_hasta,p_bloqueada})` | Admin |
| 107 | `borrarErroresAdmin` | `rpc('borrar_errores_admin')` | Admin |
| | **Alta y Stripe (servidor, service role)** | | |
| 108 | `precioAlta` | cliente `fetch('/api/alta/checkout')` GET; servidor `stripe.prices.retrieve(STRIPE_PRICE_ID)` -> `{disponible:false}\|{disponible:true,importe,moneda,intervalo}` | /alta |
| 109 | `abrirPagoAlta(email)` | cliente `fetch POST /api/alta/checkout {email}`; servidor `stripe.checkout.sessions.create({mode:"subscription",line_items,customer_email,subscription_data:{trial_period_days:14},billing_address_collection:"required",tax_id_collection:{enabled:true},locale:"es",success_url:`${origin}/alta/ok?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/alta`})` -> `{url}` o 503 | /alta |
| 110 | `codigoDeSesion(sessionId)` | cliente `fetch('/api/alta/codigo?session_id=...')` -> `{codigo}\|{error}` (400/409/500) | /alta/ok |
| 111 | `codigoDePago(sessionId)` | `stripe.checkout.sessions.retrieve(id,{expand:["subscription"]})` + `adminDb().rpc('registrar_pago_alta',{p_session,p_email,p_customer,p_subscription,p_pagado_hasta})` -> código (idempotente) | route codigo, webhook |
| 112 | `actualizarPagoSuscripcion(subId,hasta)` | `adminDb().rpc('actualizar_pago_suscripcion',{p_subscription,p_pagado_hasta})` | webhook |
| 113 | `verificarFirmaWebhook` | `stripe.webhooks.constructEvent(rawBody,header,STRIPE_WEBHOOK_SECRET)`; 400 "firma no válida", 503 "no configurado" | webhook |
| 114 | `pagadoHasta(sub)` (puro) | estado `canceled\|unpaid\|incomplete_expired` -> ahora; si no `max(current_period_end de items, trial_end, ahora)+3 días` | pagos.ts |
| | **Local / no-BD** | | |
| 115 | `leerColaFichajes` / `escribirColaFichajes` | `localStorage['obra_fichajes_pendientes']` (JSON; reintento al evento `online`, cada 20 s y al montar) | offline-fichajes |
| 116 | `leerObraGuardada` / `guardarObraActual` | `localStorage['control-de-obra:obra-id']` | ObraProvider |
| 117 | `emailRecordado` | `localStorage['control-de-obra:email']` (lee al montar, escribe al login correcto) | Login |
| 118 | `idiomaCookie` | cookie `idioma` (path=/, max-age 31536000, samesite=lax) + `idiomaDesde(accept-language)` | layout, IdiomaProvider |
| 119 | `obtenerPosicion` | `navigator.geolocation.getCurrentPosition` (alta precisión, 8000 ms, maximumAge 0) -> posición o `null` | MiFichaje, AvisoControl, ConfigurarObra |
| 120 | `registrarServiceWorker` | `navigator.serviceWorker.register('/sw.js')` | ServiceWorkerRegister |
| 121 | `updateSession(request)` | servidor: `createServerClient(...).auth.getUser()` + redirecciones | proxy.ts |
| 122 | `eventoRefrescar` | `window` evento `obra:refrescar` (escuchan: fichajes, MiFichaje, dinero, gastos) | PullToRefresh |

Helpers puros a conservar: `monthBounds`, `suma`, `pagadoPorMi`, `balanceObra`, `miCaja`, `tituloGasto`, `detalleGasto`, `avanceObra/avanceObraExacto`, `rangoObra`, `estadoTarea`, `posicionBarra/posicionDia`, `mesesDelRango`, `minutosTrabajados/minutosExtra/fmtHoras/totalesFichajes`, `distanciaMetros`, `leerArchivoExcel` (perezoso), `exportarResumenObra`, `compressImageToBlob(file,1600,0.75)`.

---

## 5. Reglas de la base de datos (lo que la emulación en memoria debe imponer)

Roles: owner = `dueno` (incluye soporte con concesión válida). "Miembro activo" = aprobado + empresa no bloqueada + (`activa_hasta` nulo o futuro) + (concesión de soporte válida).

**Identidad / alta / empresa**
1. Alta de cuenta requiere código: `empresa_codigo` (código de empresa, normalizado a mayúsculas alfanuméricas, empresa no bloqueada) => `trabajador` pendiente (aprobado=false) en esa empresa, nombre = `nombre apellidos`; error `codigo_empresa_invalido` si no existe o está bloqueada. `codigo_alta` (sin usar, no cancelado; guiones ignorados) => empresa nueva (`nombre_empresa` o 'Mi empresa'), `activa_hasta` = `pagado_hasta` del código o ahora+14 días, usuario = `dueno` aprobado, código marcado usado (usado_en, usado_por, empresa_id), un solo uso; error `codigo_alta_invalido`. Sin código => error `codigo_requerido`. (L1975-2029)
2. `comprobar_codigo_registro`: devuelve `[{tipo:'empresa', nombre}]` (código de empresa, no bloqueada), `[{tipo:'alta', nombre:null}]` (código de alta libre) o `[]` (vacío/inválido/usado/cancelado). (L1640)
3. Acceso por membresía activa: si la empresa está bloqueada o caducada, o la concesión de soporte caducó/revocada, el rol y la empresa del usuario son NULL: toda tabla de negocio devuelve vacío y las escrituras se deniegan; su fila de `miembros` y su fila de `empresas` (si aprobado) siguen legibles. Una cuenta pendiente solo ve su propia fila de `miembros`. (L1592-1632, L624-630)
4. Una membresía por cuenta; aislamiento por empresa: toda lectura/escritura limitada a la empresa propia (`empresa_id` por fila o por obra).
5. `guardar_mi_nombre(nuevo)`: fija el `miembros.nombre` propio; `confirmar_aviso_control(version)`: fija `aviso_control_leido_en = now()` y `aviso_control_version` propios. Sin sesión no hacen nada. (L391, L1181)
6. Solo el dueño puede insertar/actualizar/borrar `miembros` de su empresa (aprobar, rol, enlazar trabajador/obra); todos ven solo su propia fila. (L824-830)
7. Permisos por tabla según la matriz de la sección 3 de D (anexo): obras/trabajadores/vehiculos escritura = dueno+manager; proveedores = dueno+manager+jefe_obra; cobros = dueno+manager; entregas = solo dueno; gastos/tareas/notas/usos_vehiculo = dueno+manager+jefe_obra (su obra, o todas si `jefe_ve_todas`); el trabajador lee: obras (todas las de la empresa), nombres de trabajadores, vehiculos, usos_vehiculo, ajustes, sus fichajes y su historial; escritura de ajustes = el dueño titular de la fila.
8. Alcance del jefe de obra: `jefe_obra` solo ve/gestiona `miembros.obra_id` salvo que `ajustes.jefe_ve_todas` sea true para la empresa. (L694-697, 712-715)
9. `avance_obra(obra)`: null si el llamante no puede ver la obra; si no, media ponderada por días `sum((fin-inicio+1)*avance)/sum(fin-inicio+1)`, 0 sin tareas. El trabajador la obtiene sin leer `tareas`. (L722)

**Fichajes (horas)**
10. Único (obra_id, trabajador_id, fecha); el trabajador solo inserta/lee/actualiza filas con `trabajador_id` = su trabajador enlazado en obras de su empresa; nunca borra.
11. Escrituras de no-dueño (trabajador, manager, jefe de obra): la hora se sustituye por la hora del SERVIDOR, zona Madrid, `HH:MM`; el valor del cliente se ignora. (L966, L977)
12. No-dueño fichando un campo en fecha distinta de hoy (Madrid) => `Solo se puede fichar el día de hoy.` (L964, L975)
13. No-dueño volviendo a fichar una entrada ya rellena => `La entrada ya está fichada. Solo el dueño puede cambiarla.`; salida => `La salida ya está fichada. Solo el dueño puede cambiarla.` (reenviar el mismo valor guardado no es error; con upsert se compara la nueva hora del servidor). La entrada se comprueba antes que la salida. (L958-978)
14. No-dueño cambiando `fecha`, `obra_id` o `trabajador_id` de una fila existente => `Solo el dueño puede cambiar un fichaje ya hecho.` (L951-955)
15. No-dueño: `hora_corregida` forzada a false al insertar y conservada al actualizar. El dueño (y sin sesión) no tiene restricción: cualquier hora, cualquier fecha, puede fijar `hora_corregida`.
16. Regla de inicio de turno (no-dueño, solo al fijar entrada y si la obra tiene `hora_inicio_turno`): límite = inicio menos `minutos_antes_permitidos` (por defecto 30), comparado como cadenas 'HH:MM' con la hora del servidor; si es anterior => `Todavía no puedes fichar: el turno empieza a las {hora_inicio_turno}. Puedes entrar desde las {limite}.` La salida no se restringe. (L1163-1164)
17. `confirmado_trabajador` (por defecto true): en INSERT con `hora_corregida=true` => false; en UPDATE donde cambie entrada, salida u obra (por cualquiera) => false; si no, el valor enviado (el "Confirmo" del trabajador lo pone a true).
18. Historial: AFTER insert con `hora_corregida=true` escribe fila (antes = null, después = horas, cambiado_por = usuario). AFTER update donde cambie entrada/salida/obra escribe fila (horas antes/después; `obra_id_antes`/`obra_id_despues` solo si cambia la obra; `obra_id` = la nueva; `cambiado_por`, `cambiado_en`). Legible por gestores de la obra y por el propio trabajador; nunca escribible por clientes. (L1060-1103)
19. Manager y jefe pueden técnicamente borrar o editar fichajes por BD, pero la UI ofrece corregir/borrar solo al dueño; la emulación mantiene la UI solo-dueño.
20. `transporte` debe ser null, 'propio' o 'traido'; `traido_por` es texto libre; `ubicacion_ok` y `distancia_metros` son valores planos escritos por el cliente.

**Gastos / dinero**
21. `gastos.pagado_por` en ('empresa','personal'); no-dueño insertando 'personal' => `Solo el dueño puede apuntar gastos pagados por él.`; no-dueño actualizando/borrando una fila con `pagado_por='personal'` => `Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.`; no-dueño cambiando una fila a 'personal' => `Solo el dueño puede marcar un gasto como pagado por él.` (L1231-1243)
22. `cobros.importe > 0`, `entregas.importe > 0` (violación de check); `tareas.avance` 0..100 y `fecha_fin >= fecha_inicio`; `obras.hora_inicio_turno` nulo o `HH:MM` 00:00-23:59.
23. Unicidad: `usos_vehiculo` (vehiculo, fecha, obra); `notas_audio` (obra, fecha); `proveedores` (owner, lower(nombre)); `empresas.codigo`; `gastos.factura_origen_id`.
24. Protección referencial: no se puede borrar una obra/trabajador/vehículo con fichajes, gastos, cobros, tareas, notas, usos, etc.; la app solo cierra/desactiva. `entregas.obra_id`, `miembros.obra_id/trabajador_id`, `usos_vehiculo.conductor_id` pasan a null al quitar el padre.

**Operaciones solo-dueño**
25. `eliminar_obra(id)`: no dueño => `Solo el dueño puede borrar una obra definitivamente.`; obra no encontrada o de otra empresa => `Esa obra no existe o no es de esta empresa.`; si no, borra fichajes (+ su historial), usos_vehiculo, gastos, facturas, cobros, notas_audio, tareas y luego la obra; pone a null `entregas.obra_id`/`miembros.obra_id`.
26. `dar_acceso_soporte(email, horas=24)`: no dueño => `Solo el dueño puede dar acceso de soporte.`; horas null/<=0/>720 => `Las horas tienen que ser entre 1 y 720 (30 días).`; email desconocido => `Esa cuenta todavía no existe: tiene que registrarse primero en la app.`; cuenta ya miembro real => `Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.`; si no, crea/actualiza el miembro de soporte (rol dueno, aprobado, es_soporte) en la empresa del dueño y una fila `soporte_accesos` que expira en `horas` horas. El soporte tiene poderes de dueño mientras la concesión sea válida.
27. `revocar_acceso_soporte(id)`: no dueño => `Solo el dueño puede quitar el acceso de soporte.`; marca revocado y borra la fila de miembro de soporte; id desconocido/ya revocado => nada. `soporte_accesos` solo lo lee el dueño de la empresa.

**Admin de plataforma**
28. Admin = cuenta en `admins_plataforma`. Los RPC de listado (`listar_empresas_admin`, `listar_codigos_alta`, `listar_errores_admin`) devuelven vacío a no-admins; los mutadores (`crear_codigo_alta`, `cancelar_codigo_alta`, `establecer_suscripcion`, `borrar_errores_admin`) lanzan `no autorizado`. Formato de código `XXXX-XXXX-XXXX`; `cancelar` solo afecta a códigos sin usar ni cancelar; `establecer_suscripcion(empresa, activa_hasta|null, bloqueada|null->false)`.
29. `listar_empresas_admin` columnas: id, nombre, codigo, created_at, miembros_count (sin soporte), obras_count (todas las obras), activa_hasta, bloqueada, codigo_alta; más nuevas primero. `listar_codigos_alta` columnas: id, codigo, nota, creado_en, estado ('libre'|'usado'|'cancelado'), empresa_nombre, usado_en, email, pagado. `listar_errores_admin(limite)` acota 1..500, más nuevos primero.
30. `registrar_error`: invocable sin sesión; se descarta en silencio si hay 300+ errores en la última hora; origen forzado a 'servidor' o 'navegador'; mensaje recortado, vacío => `(sin mensaje)`, truncado a 500 (detalle 4000, ruta 300, navegador 300); guarda usuario y empresa si se conocen.
31. RPC de facturación (solo servidor): `registrar_pago_alta` idempotente por sesión Stripe; `actualizar_pago_suscripcion` mueve `activa_hasta` solo en empresas que ya tienen caducidad.

**Storage**
32. Buckets `facturas` y `notas` privados; solo dueno/manager/jefe de obra (regla 8) de la obra cuyo id es el primer segmento de la ruta pueden leer/escribir/borrar objetos; el trabajador no. Primer segmento no UUID => error.

**Valores por defecto**
33. Una empresa sin fila en `ajustes` se comporta como: `jornada_horas` 8, `jefe_ve_todas` false, los cinco módulos ON. Una empresa nueva no tiene proveedores por defecto en v1 (el script de siembra, en la práctica, no sembró nada).

---

## 6. Discrepancias código <-> especificación

Tipos: `defecto §20` = listado en SPEC §20, a corregir en v2; `defecto` = fallo claro de v1 fuera de §20; `diferencia` = SPEC y código difieren, gana el código; `BD más amplia que UI`; `sin aclarar`. Orden: lo que el usuario nota primero (cifras, datos mostrados, errores silenciosos), luego el resto.

| id | SPEC | Dónde (v1) | Qué dice la spec | Qué hace el código | Tipo |
|---|---|---|---|---|---|
| DIS-01 | HOM-03 | `app/(dashboard)/page.tsx:93,108-109` | "Horas del mes" = suma del mes | Suma solo las filas de los últimos 14 días: subcuenta desde el día 15 | defecto |
| DIS-02 | HOM-02 | `components/ui/NumeroGrande.tsx:17-19` | Avance con dos decimales | Separador "," fijo (no sigue el idioma); si el resto redondea a 100 muestra ",100" (p. ej. 60,999) | defecto |
| DIS-03 | DIN-05 | `resumen/page.tsx:436,442,503`; `PagadoPor.tsx` `totalPersonal`; `planificacion/page.tsx` (presupuestado) | Todas las sumas en céntimos | Resumen, `totalPersonal` y "Presupuestado" suman con floats (riesgo de error de 1 céntimo) | defecto |
| DIS-04 | RES-05, GAS | `resumen/page.tsx:437-449` | Tarjetas por categoría que suman el total | Categorías antiguas fuera de `CATEGORIAS_GASTO` entran en "Total del mes" pero no tienen tarjeta: los % suman < 100 | defecto |
| DIS-05 | HOM-W4 | `components/inicio/InicioTrabajador.tsx:35-40,49` | Entrada/Salida de hoy | Lee `fichajes` de hoy sin filtrar obra ni orden (`limit(1)`): con 2 obras muestra una arbitraria y el CTA depende de ella | defecto |
| DIS-06 | FIC-07 | `MiFichaje.tsx:467-481`; `fichajes/page.tsx:125-132` | Geovalla al fichar | Cada fichaje del trabajador (también Salida) sobrescribe `ubicacion_ok/distancia_metros`; sin GPS los pone a `null` y borra la geovalla de la entrada. La cuadrilla nunca los envía | defecto |
| DIS-07 | GAS-05 | `gastos/page.tsx:374,413` | Editar conserva datos | Editar una factura antigua con `concepto` "Factura" o igual al proveedor deja la nota vacía y guarda `concepto: null` sin avisar | defecto |
| DIS-08 | Q-01, HOM-05 | Home `page.tsx` vs `dinero/page.tsx:106-107` | Dos fórmulas de balance (decisión pendiente) | Home: cobrado - gastado; Dinero (dueño): cobrado + recibido del jefe (esta obra) - gastado; pueden no coincidir | sin aclarar |
| DIS-09 | DIN-02 | `dinero/page.tsx:106-107` | "Recibido del jefe (esta obra)" solo con dueño + módulo ON | El balance suma las entregas de la obra aunque `caja_jefe` esté OFF (solo se oculta la línea) | sin aclarar |
| DIS-10 | FIC-13..14, 34 | `fichajes/page.tsx` (insignias) + BD `registrar_correccion_fichaje` | "Sin confirmar" solo si hay corrección | La cuadrilla muestra "Sin confirmar" si `confirmado_trabajador === false`; la BD lo pone a false en cualquier cambio de hora/obra, incluida la Salida normal del trabajador (D §8.3). La UI debe condicionar por `hora_corregida` | defecto |
| DIS-11 | FIC-08 | `lib/offline-fichajes.ts:117` | Los errores de negocio se muestran | En la cola, un error de negocio descarta el item sin avisar (solo los fallos de red se conservan) | defecto |
| DIS-12 | SHL-08 | `lib/obra-context.tsx:91-105` | Error de carga distinto de "sin obras" | Un error de lectura de `obras` deja `[]` y se ve "Crea tu primera obra"/"Todavía no hay obra" | defecto |
| DIS-13 | - | Home, gastos, dinero, vehículos, notas, resumen | Estados de carga/error (§18) | Errores de lectura ignorados (`data ?? []`) y sin estado de carga (Home pinta 0; "Todavía no hay trabajadores" parpadea). Solo Planificación muestra el error de carga | defecto |
| DIS-14 | FIC-14 | `fichajes/page.tsx:68-75` | Lista de trabajadores al día | Se lee una vez al montar; ni pull-to-refresh ni cambio de obra/día la actualizan | defecto |
| DIS-15 | SHL-07 | Home (gestor y trabajador); vehículos, notas, planificación, resumen | Pantallas se refrescan con `obra:refrescar` | Solo escuchan gastos, dinero, fichajes y MiFichaje | defecto |
| DIS-16 | - | `fichajes/page.tsx:106-113` (`ponerEnLista`) | - | Inserta/actualiza por `id` sin comprobar obra/día mostrados: los reintentos de la cola pueden colar filas de otra obra/día | defecto |
| DIS-17 | FIC-06 | `fichajes/page.tsx:196-208`; `MiFichaje.tsx:428-444` | Nunca filas fantasma (sin horas) | Zona, transporte y ubicación pueden crear una fila sin horas; solo el sheet de corrección lo evita. `guardarUbicacion` sin tratamiento de error | defecto |
| DIS-18 | FIC-36 | `MiFichaje.tsx:619-627` | Zona/tarea solo hoy | El botón se muestra otros días y no hace nada. Título del sheet "Zona / tarea"; "¿Dónde has trabajado hoy?" es el label | defecto |
| DIS-19 | FIC-34 | `MiFichaje.tsx:563-570` | Caja "Confirmo" si corregida y sin confirmar | Aparece si `confirmado_trabajador` es falsy (también `null`), aunque `hora_corregida` sea false | defecto |
| DIS-20 | §20.1, SHL-04/06 | `ObraPicker.tsx:44-50`; `SinObras.tsx` | "Nueva obra" solo dueno/manager | Visible para todos los roles; `crearObra` falla en silencio (sin mensaje) | defecto §20 |
| DIS-21 | §20.2, FIC-15 | `fichajes/page.tsx:396-408` | "Añadir trabajador" solo dueno/manager (la BD lo exige) | Visible a todos los gestores; inserta con `owner_id`; sin mensaje de error | defecto §20 |
| DIS-22 | VEH-04 | `vehiculos/page.tsx:151,65-72` | Alta de vehículo: dueno+manager | Solo se bloquea al trabajador: el jefe de obra ve "Añadir vehículo" y el fallo es silencioso | defecto |
| DIS-23 | - | `Accesos.tsx` (`actualizar`, `eliminar`), `ajustes/page.tsx` (toggles y altas), `SoporteAcceso` (revocar), `admin/page.tsx` | Errores de escritura visibles | Errores ignorados; `eliminar` quita la fila de la lista aunque la BD falle. Solo `crearCodigo` y `darAccesoSoporte` muestran error | defecto |
| DIS-24 | DIN-04 | `dinero/page.tsx:112-113,122-125` | Borrado con dos pasos | `borrarCobro` borra el archivo antes que la fila y sin tratar errores (si RLS bloquea, el justificante ya se perdió); `borrarEntrega` ignora el error | defecto |
| DIS-25 | NOT-03 | `notas/page.tsx` (`borrar`, `guardarGrabacion`) | Reemplazar/borrar nota | `borrar` elimina el audio antes que la fila, errores ignorados; al grabar se usa la `nota` del estado (posible dato obsoleto si se cambia de día grabando) | sin aclarar |
| DIS-26 | PLA-05, 06 | `planificacion/page.tsx:151-155,203` | Errores visibles; importar | Importar con reemplazo = borrar y luego insertar, no atómico (puede quedar plan vacío); el error sale en banner detrás del sheet y con prefijo "No se ha podido guardar:" incluso para errores de carga | defecto |
| DIS-27 | PLT-02 | `public/sw.js:23-42` | Cachear GET estáticos | Cachea cualquier GET del mismo origen no-navegación (incluye `/api/*` y RSC) | diferencia |
| DIS-28 | PLT-03 | `app/error.tsx:10`, `global-error.tsx:11` | Botón Reintentar | Declara la prop `retry`; en Next 16 el nombre podría ser otro (no verificado) | resuelto: Next 16.3 documenta `retry` (error.md) |
| DIS-29 | §20.3 | `HOM-05`, `page.tsx:251-256` | Textos traducidos | "Cobrado", "Gastado", "Balance" sin `tr()` | defecto §20 |
| DIS-30 | §20.3 | `CorregirHorasForm.tsx:697-698` (`fmtCambio`) | Fechas según idioma | `toLocaleString("es-ES")` fijo | defecto §20 |
| DIS-31 | §20.3 | `SoporteAcceso.tsx:115,129` | Estados traducidos | "Hasta {fecha}" literal con `es-ES` y palabras `caducado`/`revocado` crudas | defecto §20 |
| DIS-32 | §20.3 | `admin/page.tsx:13,249` | Fechas y estados traducidos | `fecha()` con `es-ES` fijo; literal "cancelado" sin `tr()` | defecto §20 |
| DIS-33 | §20.3 | `alta/page.tsx:46-50` | Precio según idioma | `Intl.NumberFormat("es-ES")` fijo | defecto §20 |
| DIS-34 | §20.3, RES-02 | `lib/exportar-excel.ts` | Cabeceras traducidas (el fichero puede quedar en español) | Cabeceras de las hojas Horas, Gastos, Vehículos y Correcciones fijas en español; `toLocaleString("es-ES")` en Correcciones | defecto §20 |
| DIS-35 | §20.5 | `SoporteAcceso.tsx:64` | Sin impurezas en render | `Date.now()` en el render para el estado de la concesión (lint `react-hooks/purity`) | defecto §20 |
| DIS-36 | AJU-02 | `Accesos.tsx:25,219` | Rol traducido | `etiquetaRol` devuelve la etiqueta en español sin `tr()` | defecto |
| DIS-37 | ACC-02 | `login/page.tsx:272,112,138,150` | Errores traducidos | `error.startsWith("Contraseña incorrecta")` falla en uk/en (no sale la pista "Si sigue fallando..."); el resto de errores de Supabase salen crudos; `minLength=6` también en modo login | defecto |
| DIS-38 | PLT-01 | `app/layout.tsx:27-30` | i18n total | `metadata.description` en español fijo | defecto |
| DIS-39 | - | `lib/horas.ts` (`fmtHoras`); `lib/gantt.ts` (`mesesDelRango`); `LandingMock.tsx` | i18n total | `fmtHoras` ("h", "m", "—"), meses del Gantt (`es-ES`), `OBRAS_DEMO` y "72%" fuera de `tr()`/locale | defecto |
| DIS-40 | ACC-11 | `AvisoControl.tsx:68-83` (C: 232-236, 245-247) | Texto de ubicación solo con el módulo ON | Párrafos de ubicación y de permiso siempre visibles; solo `obtenerPosicion()` depende del módulo | diferencia |
| DIS-41 | GAS-05 | `lib/image.ts:3` | Compresión <= 1600 px | Solo limita el ancho: una foto alta puede pasar de 1600 px de alto | diferencia |
| DIS-42 | GAS-05, DIN | `gastos/page.tsx:505`; `dinero/page.tsx` | Fecha con máximo hoy | `max={todayStr()}` solo como atributo HTML, sin validación JS | diferencia |
| DIS-43 | AJU-04 | `ajustes/page.tsx:143-147` | Jornada 1-24 en pasos de 0.5 | Acepta cualquier valor `>0 && <=24`; `min=1` no se aplica | diferencia |
| DIS-44 | AJU-07 | `ConfigurarObra.tsx:55,57,91,105` | Radio por defecto 150 (mín. 20); minutos por defecto 30 | Solo hay fallback `\|\| 150`; `min=20` no se aplica; no hay "30" en código (valor de la columna; fallback al guardar = 0); los minutos se guardan aunque el campo esté oculto; la ubicación no se puede borrar | defecto |
| DIS-45 | GAS-04 | `lib/gastos.ts:11-13` | Segunda línea: nota si no es el título | También omite la categoría si es igual al título y la nota "Factura" | diferencia |
| DIS-46 | GAS-06 | `gastos/page.tsx:92-106` | Proveedores favoritos sembrados; sin duplicados sin distinguir mayúsculas | Los favoritos no están en el cliente; la deduplicación es solo del cliente; el proveedor se crea antes que el gasto (puede quedar sin gasto si este falla) | sin aclarar |
| DIS-47 | GAS-03 | `gastos/page.tsx:394,411` | - | Editar y mover un gasto a otra obra sin archivo nuevo deja el archivo en la carpeta de la obra antigua; la política de storage mira solo el primer segmento: posible pérdida de acceso | sin aclarar |
| DIS-48 | DIN-04 | `dinero/page.tsx:86` | Entregas de la obra actual | La lista "Del jefe" muestra las entregas de todas las obras (la caja es global) | diferencia |
| DIS-49 | §2 | `AccesoGate.tsx:25-27`, `lib/nav.ts` | Rutas bloqueadas por rol | El bloqueo cubre solo al trabajador; el jefe de obra no es bloqueado en `/dinero` (la página muestra "Solo para el dueño y el manager") | diferencia |
| DIS-50 | RES-04 | `resumen/page.tsx:80` | Solo activos | Lista vehículos inactivos y trabajadores sin filtrar por `activo` | defecto |
| DIS-51 | RES-02 | `lib/exportar-excel.ts` | Hoja Vehículos | Sin columna Obra; la librería `xlsx` se carga de forma estática en `/resumen` | diferencia |
| DIS-52 | PLA-05 | `lib/importar-excel.ts` | Import con cabeceras `WEEK`/`AMOUNT`/`TOTAL` | Acepta además `PRESUPUESTO`, `СУМА`, `ВАРТІСТЬ`, la 5ª columna, más palabras de capítulo, `.xlsm`; ignora filas `TOTAL…` | diferencia |
| DIS-53 | HOM-05 | `page.tsx` tarjeta Dinero | Cifras en euros enteros | El jefe de obra ve "Gastado en total" con `fmtEUR` (céntimos) | diferencia |
| DIS-54 | HOM-W4/W3 | `InicioTrabajador.tsx` | Texto del héroe | Subtexto "{horas} extra" (en `/fichajes`: "{horas} extra este mes"); sin `trabajador_id` muestra ceros y "Marcar mi entrada" sin aviso; el bloque de avance depende de `typeof data === "number"` | sin aclarar |
| DIS-55 | Q-06 | `InicioTrabajador.tsx` | Tile "Días" | `dias = filas.length` del mes, incluye filas sin horas | sin aclarar |
| DIS-56 | FIC-33, FIC-13 | `MiFichaje.tsx`; `fichajes/page.tsx:256-261` | "N fichajes en cola" | El banner del trabajador es fijo (sin N); el de la cuadrilla cuenta todas las pendientes del móvil, no solo obra/día mostrados | diferencia |
| DIS-57 | FIC-02, Q-02 | `lib/format.ts:15-20`; cola offline | Hora/fecha del servidor (Madrid); la cola conserva la hora del teléfono | Cliente usa la zona del dispositivo; la hora encolada se envía pero el servidor la reemplaza: un fichaje sin cobertura se registra con la hora de entrega | sin aclarar |
| DIS-58 | FIC-20 | `CorregirHorasForm.tsx` | Nombre y fecha en el encabezado | Título del Sheet "Corregir horas"; nombre y fecha en el cuerpo; el historial va después del botón Guardar | diferencia |
| DIS-59 | SHL-03 | `TopBar.tsx:49-57` | Atajo a Resumen en móvil | Se muestra también en escritorio (el sidebar ya lo tiene) | diferencia |
| DIS-60 | ACC-14 | `SuscripcionInactiva.tsx:39`; `ajustes/page.tsx:102 vs :381` | Cerrar sesión en cada gate | Etiqueta "Salir" en esa gate; Sidebar y Ajustes (gestor) salen a `/login`, gates y Ajustes (trabajador) a `/` | diferencia |
| DIS-61 | ONB-03 | `lib/pagos.ts:38-45` | Fin = ahora si cancelada/impagada | También `incomplete_expired`; el fin se acota por abajo a "ahora" (+3 días de margen) | diferencia |
| DIS-62 | ONB-02 | `alta/ok/page.tsx` | Mostrar el código | Sin reintentos: un 409 "todavía no completado" se ve como "Pago sin confirmar"; el estado "copiado" no se reinicia | sin aclarar |
| DIS-63 | - | `Accesos.tsx:112-117` | - | El portapapeles de "Copiar enlace" sin try/catch (admin y alta/ok sí lo tienen) | defecto |
| DIS-64 | §15 | `admin/layout.tsx:40-48` | Admin sin sesión -> `/login` | Sin sesión se ve un instante "Esto no es para esta cuenta" antes de redirigir | defecto |
| DIS-65 | PLT-06, §17 | `obra-context.tsx:64-67,77-80`; `miembro-context.tsx:93-95`; inserts de trabajadores/vehiculos/obras | Filas con `empresa_id`, `ajustes` una fila por empresa | El cliente envía `owner_id` y hace upsert de `ajustes` sin `onConflict`; `empresa_id` lo resuelve la BD (default `mi_empresa_id()`) | sin aclarar |
| DIS-66 | AJU, §17 | BD `ajustes` (L305-309) | Ajustes por empresa | PK = `owner_id`; no se crea fila alguna; el soporte (dueno) no puede editarla; con dos filas por empresa `puede_*_obra` del jefe falla ("more than one row returned") | BD más amplia que UI |
| DIS-67 | §1.2 | BD `fichajes` (L873) | Borrar/editar fichajes solo dueno | Manager y jefe pueden borrar/editar fichajes por RLS (horas forzadas a hora de servidor) | BD más amplia que UI |
| DIS-68 | §1.2, AJU-07 | BD `obras` ("obras write") | Ubicación/horario solo dueno | El manager puede actualizar y borrar filas de `obras` (solo lo frena RESTRICT) | BD más amplia que UI |
| DIS-69 | SHL-05 | BD `puede_ver_obra` | El trabajador ve obras activas | Lee todas las obras de la empresa; el filtro por activa es de la UI | BD más amplia que UI |
| DIS-70 | Q-03 | BD `trabajadores` select | Trabajador ve solo a sí mismo (docs antiguos) | Lee todos los nombres de trabajadores de la empresa | BD más amplia que UI |
| DIS-71 | FIC-30..38 | BD policy "fichajes propios" (L884-908) | - | El UPDATE del trabajador permite cambiar cualquier columna de su fila (`ubicacion`, `transporte`, `confirmado_trabajador`, `ubicacion_ok`, `distancia_metros`); solo horas/fecha/obra/trabajador/`hora_corregida` los guardan los triggers | BD más amplia que UI |
| DIS-72 | §15 | BD `crear_miembro` | El admin no pertenece a ninguna empresa | Todo alta exige código y crea `miembros`: el admin también tiene fila; la BD no impide que sea miembro | BD más amplia que UI |
| DIS-73 | GAS-06 | BD `proveedores` (L523-540) | Favoritos Leroy Merlin, Obramat, BigMat | La siembra no hizo nada en BD nueva (`owner_empresa()` es NULL); una empresa nueva no tiene proveedores; unicidad por `owner_id`, no por empresa | diferencia |
| DIS-74 | FIC-04 | BD `validar_hora_fichaje` | Hora mínima de entrada | Si inicio - minutos cruza la medianoche (00:15 y 30 -> '23:45') bloquea todas las entradas normales; compara cadenas 'HH:MM' | defecto |
| DIS-75 | AJU-08 | BD `eliminar_obra` | Borrado de obra | Un historial con `obra_id` = esa obra de un fichaje que ya está en otra obra rompe el borrado por FK | defecto |
| DIS-76 | - | BD `registrar_error` | - | El límite de 300 errores/hora es global para toda la plataforma | sin aclarar |
| DIS-77 | ONB, ACC-03 | BD `comprobar_codigo_registro`, `crear_miembro` | - | Aceptan códigos de empresas caducadas (solo las bloqueadas dan `codigo_empresa_invalido`) | sin aclarar |
| DIS-78 | GAS-05, DIN-04 | BD storage (L1341-1361) | - | Política con cast a UUID del primer segmento: una ruta no UUID da error de cast, no denegación limpia | sin aclarar |

---

## 7. Lecciones de v1 a conservar

- `lib/format.ts:4-11` - nunca `toISOString()` para fechas locales (UTC desplaza el día); `:60-65` `monthBounds` con `gte/lt` (`${mes}-32` lo rechaza Postgres); `lib/gantt.ts:1-12` fechas como cadenas, `diasEntre` redondea por el cambio horario.
- `lib/miembro-context.tsx:56-58` - filtrar `miembros` por `user_id` (el dueño lee todas); `:65-67` leer `empresas` aparte porque `mi_empresa_id()` da NULL justo con suscripción caducada.
- `lib/obra-context.tsx:92-96` - respetar la obra elegida en sesión aunque esté cerrada; el arranque en frío prefiere una activa.
- `lib/supabase/middleware.ts:4-7` - `/` por igualdad exacta (con `startsWith` todo sería público); `:11-14` `/reset-password` no redirige con sesión.
- `public/sw.js:4-8` - no cachear navegaciones (el móvil se quedaba con la versión antigua); offline real = cola de datos aparte.
- `lib/offline-fichajes.ts:44-46, 103-104` - solo los fallos de red se encolan; "ya está fichad" = el primer intento sí llegó: leer el valor real y parar. `:38-41` almacenamiento lleno: se pierde la cola, no la app.
- `components/ui/StampButton.tsx:33-37` - una hora fichada o pendiente no se vuelve a fichar. `fichajes/page.tsx:123-124` - vale la hora del servidor: mostrar lo que devuelve.
- `fichajes/page.tsx:498-503, 583-585` - no crear fichajes vacíos; botón × por input de hora (iOS no deja vaciar). `MiFichaje.tsx:408` - del mes cuentan TODAS las obras. `fichajes/page.tsx:60-61, 95-98` - enlace a las otras obras del día (si no, las horas "se pierden").
- `lib/gastos.ts`, `lib/dinero.ts` - sumas en céntimos (floats daban 0.30000000000000004). `gastos/page.tsx:88-91` devolver el nombre de proveedor guardado; `:123-124` los archivos de facturas antiguas se comparten con la copia congelada: nunca borrar.
- `SelectorArchivo.tsx:325-326` - la ruta de storage debe empezar por el id de obra (la política solo mira ese segmento); `:248-249` comprimir fotos (no subían con poca cobertura).
- `dinero/page.tsx:29-37, 83-84, 104-105, 576` - dos cuentas separadas (obra y "mi caja"); la caja es de todas las obras; el dinero del jefe es general y la obra solo ayuda a recordar. `:41-42` el jefe de obra no ve lo cobrado.
- `vehiculos/page.tsx:20-27` - cada obra-día es su propio registro: mostrar todas las obras, no solo la elegida.
- `lib/importar-excel.ts:205-207, 287` - el primer capítulo puede estar sobre la fila de semanas; `cellStyles` es obligatorio o no hay fechas.
- `components/ajustes/Accesos.tsx:27-31` - nadie se sube el nivel a sí mismo (también lo impide la BD). `SoporteAcceso.tsx:243-249` - las concesiones caducan solas y quedan registradas.
- `components/ajustes/EliminarObra.tsx:129-134`, `lib/eliminar-obra.ts:3-9` - doble candado (nombre exacto + contraseña); Storage primero, luego una transacción en servidor.
- `AvisoControl.tsx:14-21, 178-185, 195-197`; `types.ts:81-84` - aviso informativo, no "consentimiento"; subir `AVISO_CONTROL_VERSION` solo si cambia el contenido; si no se concede la ubicación se ficha igual.
- `login/page.tsx:17, 52-53, 77-78, 104-105, 161-162, 267-268` - enfocar la contraseña; debounce del código (400 ms); solo se recuerda el email; con contraseña errónea se conserva el email; flecha atrás en la PWA instalada; error visible con el teclado de iPhone abierto.
- `lib/pagos.ts:3-5, 26`, `api/stripe/webhook/route.ts:6-9` - secretos solo en servidor; sin claves = pago "no disponible"; firma del webhook obligatoria; 3 días de margen.
- `app/admin/layout.tsx:12-18` - el admin de plataforma es una clase de cuenta aparte, sin providers del dashboard.
- `app/layout.tsx:49-52, 56-58` - `viewportFit: "cover"` y `force-dynamic`; `DashboardShell.tsx:20-24` `min-w-0`; `TopBar.tsx:22-23, 26` safe-area y logo siempre a Inicio; `lib/nav.ts:22-23, 37-39, 57-59` 7º icono no cabe en iPhone estrecho, el jefe no ve Dinero.
- `lib/i18n/index.ts` (cabecera) - la clave es el texto en español y, si falta traducción, sale en español; `provider.tsx` remonta toda la app al cambiar de idioma.
- `lib/errores.ts:3-7`, `instrumentation.ts:3-6` - el aviso de un error nunca debe provocar otro error.
