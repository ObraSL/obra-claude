/**
 * Comprobación de la base de datos en memoria (lib/datos/memoria).
 * Uso:  node --import ./_pack/herramientas/alias-loader.mjs scripts/test-memoria.ts
 */
process.env.TZ = "Europe/Madrid";

import assert from "node:assert/strict";
import {
  CLAVE_DEMO,
  CUENTAS_DEMO,
  confirmarEmail,
  crearAlmacen,
  crearClienteMemoria,
  deserializarAlmacen,
  serializarAlmacen,
  type Almacen,
  type ModoRed,
} from "../lib/datos/memoria/index";

const ok = (m: string) => console.log(`✓ ${m}`);

// Lunes 16/11/2026, 10:30 en Madrid (CET = UTC+1)
const BASE = new Date("2026-11-16T09:30:00Z");
let ahora = BASE;
const horaMadrid = (hhmm: string, fecha = "2026-11-16") => {
  ahora = new Date(`${fecha}T${hhmm}:00+01:00`);
};

const nuevo = () => {
  ahora = BASE;
  return crearAlmacen("poblado", BASE);
};

type Cliente = ReturnType<typeof crearClienteMemoria>;
const cliente = (almacen: Almacen, extra: { red?: () => ModoRed; alCambiar?: () => void } = {}): Cliente =>
  crearClienteMemoria({ almacen, reloj: () => ahora, ...extra });

async function como(almacen: Almacen, email: string): Promise<Cliente> {
  const db = cliente(almacen);
  const r = await db.auth.signInWithPassword({ email, password: CLAVE_DEMO });
  assert.equal(r.error, null, `no se pudo entrar como ${email}`);
  return db;
}

const MARTA = "marta.salvia@reformas-salvia.invalid";
const LUIS = "luis.ortega@reformas-salvia.invalid";
const RAQUEL = "raquel.vidal@reformas-salvia.invalid";
const DIEGO = "diego.navarro@reformas-salvia.invalid";
const IVAN = "ivan.soto@construcciones-ejemplo.invalid";
const ANA = "ana.ejemplo@construcciones-ejemplo.invalid";
const GLORIA = "gloria.roble@carpinteria-roble.invalid";
const ADMIN = "admin@plataforma.invalid";
const SOPORTE = "soporte@soporte-desarrollo.invalid";

const idObra = (a: Almacen, nombreParte: string) =>
  String(a.tablas.obras.find((o) => String(o.nombre).includes(nombreParte))!.id);

async function main() {
  // --- Semilla y sesión -------------------------------------------------------
  {
    const a = nuevo();
    assert.equal(a.tablas.empresas.length, 3);
    assert.equal(a.tablas.obras.filter((o) => o.activa).length, 4);
    for (const c of CUENTAS_DEMO) assert.ok(a.usuarios.some((u) => u.email === c.email), c.email);
    const db = cliente(a);
    const mala = await db.auth.signInWithPassword({ email: MARTA, password: "otra" });
    assert.equal(mala.error?.message, "Invalid login credentials");
    ok("semilla creada y login con contraseña errónea rechazado");
  }

  // --- Fichajes: hora del servidor -------------------------------------------
  {
    const a = nuevo();
    const ivan = await como(a, IVAN);
    const obraB = idObra(a, "Nave logística");
    const trabajadorId = String(a.tablas.miembros.find((m) => m.email === IVAN)!.trabajador_id);
    horaMadrid("08:15");
    const r = await ivan
      .from("fichajes")
      .insert({ obra_id: obraB, trabajador_id: trabajadorId, fecha: "2026-11-16", hora_entrada: "03:00", ubicacion_ok: true })
      .select()
      .single();
    assert.equal(r.error, null);
    assert.equal(r.data.hora_entrada, "08:15");
    assert.equal(r.data.hora_corregida, false);
    assert.equal(r.data.confirmado_trabajador, true);
    ok("el trabajador ficha la entrada: se guarda la hora del servidor, no la enviada");

    horaMadrid("08:16");
    const otra = await ivan.from("fichajes").update({ hora_entrada: "08:16" }).eq("id", r.data.id);
    assert.equal(otra.error?.message, "La entrada ya está fichada. Solo el dueño puede cambiarla.");
    // reenviar el mismo valor guardado no es un error
    const igual = await ivan.from("fichajes").update({ hora_entrada: "08:15" }).eq("id", r.data.id);
    assert.equal(igual.error, null);
    ok("volver a fichar la entrada: error exacto; reenviar el mismo valor no falla");

    const salida = await ivan.from("fichajes").update({ hora_salida: "00:00" }).eq("id", r.data.id).select().single();
    assert.equal(salida.data.hora_salida, "08:16");
    assert.equal(salida.data.confirmado_trabajador, false); // el trigger lo baja en cualquier cambio de horas
    assert.equal(a.tablas.fichajes_historial.filter((h) => h.fichaje_id === r.data.id).length, 1);
    const dos = await ivan.from("fichajes").update({ hora_salida: "09:00" }).eq("id", r.data.id);
    assert.equal(dos.error?.message, "La salida ya está fichada. Solo el dueño puede cambiarla.");
    ok("la salida usa la hora del servidor, baja confirmado_trabajador y escribe historial");

    const ayer = await ivan
      .from("fichajes")
      .insert({ obra_id: obraB, trabajador_id: trabajadorId, fecha: "2026-11-15", hora_entrada: "08:30" });
    assert.equal(ayer.error?.message, "Solo se puede fichar el día de hoy.");
    ok("fichar otro día: 'Solo se puede fichar el día de hoy.'");

    const cambio = await ivan.from("fichajes").update({ fecha: "2026-11-15" }).eq("id", r.data.id);
    assert.equal(cambio.error?.message, "Solo el dueño puede cambiar un fichaje ya hecho.");
    ok("un no-dueño no puede mover la fecha de un fichaje");
  }

  {
    const a = nuevo();
    const ivan = await como(a, IVAN);
    const obraB = idObra(a, "Nave logística");
    const trabajadorId = String(a.tablas.miembros.find((m) => m.email === IVAN)!.trabajador_id);
    horaMadrid("07:00");
    const r = await ivan.from("fichajes").insert({ obra_id: obraB, trabajador_id: trabajadorId, fecha: "2026-11-16", hora_entrada: "07:00" });
    assert.equal(r.error?.message, "Todavía no puedes fichar: el turno empieza a las 08:00. Puedes entrar desde las 07:30.");
    assert.equal(a.tablas.fichajes.filter((f) => f.trabajador_id === trabajadorId && f.fecha === "2026-11-16").length, 0);
    horaMadrid("07:30");
    const bien = await ivan.from("fichajes").insert({ obra_id: obraB, trabajador_id: trabajadorId, fecha: "2026-11-16", hora_entrada: "07:30" });
    assert.equal(bien.error, null);
    ok("regla de inicio de turno: mensaje exacto antes de la hora, permitido a la hora límite");
  }

  // --- Corrección del dueño y confirmación -----------------------------------
  {
    const a = nuevo();
    const marta = await como(a, MARTA);
    const diego = await como(a, DIEGO);
    const miTrab = String(a.tablas.miembros.find((m) => m.email === DIEGO)!.trabajador_id);
    const f = a.tablas.fichajes.find((x) => x.trabajador_id === miTrab && x.fecha === "2026-11-16")!;
    const antes = a.tablas.fichajes_historial.length;
    const r = await marta
      .from("fichajes")
      .update({ hora_entrada: "07:00", hora_corregida: true })
      .eq("id", f.id)
      .select()
      .single();
    assert.equal(r.error, null);
    assert.equal(r.data.hora_entrada, "07:00");
    assert.equal(r.data.hora_corregida, true);
    assert.equal(r.data.confirmado_trabajador, false);
    assert.equal(a.tablas.fichajes_historial.length, antes + 1);
    const h = a.tablas.fichajes_historial[a.tablas.fichajes_historial.length - 1];
    assert.equal(h.hora_entrada_antes, "07:32");
    assert.equal(h.hora_entrada_despues, "07:00");
    assert.equal(h.cambiado_por, a.usuarios.find((u) => u.email === MARTA)!.id);
    ok("el dueño corrige: hora_corregida, confirmado_trabajador=false e historial");

    const vista = await diego.from("fichajes_historial").select("*").eq("fichaje_id", f.id);
    assert.equal(vista.data.length, 1);
    const confirma = await diego.from("fichajes").update({ confirmado_trabajador: true }).eq("id", f.id).select().single();
    assert.equal(confirma.error, null);
    assert.equal(confirma.data.confirmado_trabajador, true);
    assert.equal(confirma.data.hora_corregida, true);
    ok("el trabajador ve el historial y pulsa 'Confirmo'");

    const nuevaObra = await marta
      .from("fichajes")
      .insert({ obra_id: f.obra_id, trabajador_id: a.tablas.trabajadores.find((t) => t.nombre === "Hugo Molina")!.id, fecha: "2026-11-14", hora_entrada: "07:40", hora_salida: "16:10", hora_corregida: true })
      .select()
      .single();
    assert.equal(nuevaObra.error, null);
    assert.equal(nuevaObra.data.confirmado_trabajador, false);
    ok("el dueño puede escribir otro día; insertar con hora_corregida deja sin confirmar");
  }

  // --- Aislamiento y alcance -------------------------------------------------
  {
    const a = nuevo();
    const diego = await como(a, DIEGO);
    const miTrab = String(a.tablas.miembros.find((m) => m.email === DIEGO)!.trabajador_id);
    const r = await diego.from("fichajes").select("*");
    assert.ok(r.data.length > 10);
    assert.ok(r.data.every((f: { trabajador_id: string }) => f.trabajador_id === miTrab));
    const obras = await diego.from("obras").select("id,nombre");
    assert.equal(obras.data.length, 3); // los trabajadores leen todas las obras de su empresa
    const gastos = await diego.from("gastos").select("*");
    assert.equal(gastos.data.length, 0);
    const trab = await diego.from("trabajadores").select("nombre");
    assert.ok(trab.data.length >= 8);
    ok("el trabajador solo lee sus fichajes; ve obras y compañeros; no ve gastos");

    const mal = await diego.from("gastos").insert({ obra_id: idObra(a, "Olmo"), importe: 5, categoria: "Otros", fecha: "2026-11-16" });
    assert.equal(mal.error?.code, "42501");
    assert.equal(mal.error?.message, 'new row violates row-level security policy for table "gastos"');
    ok("RLS en inserción: código 42501 y mensaje exacto");
  }

  {
    const a = nuevo();
    const luis = await como(a, LUIS);
    const obras = await luis.from("obras").select("*");
    assert.equal(obras.data.length, 3);
    assert.ok(obras.data.every((o: { empresa_id: string }) => o.empresa_id === a.tablas.empresas.find((e) => e.nombre === "Reformas Salvia")!.id));
    const ajena = await luis.from("obras").select("*").eq("id", idObra(a, "Nave logística"));
    assert.equal(ajena.data.length, 0);
    const trucar = await luis.from("obras").update({ nombre: "hackeada" }).eq("id", idObra(a, "Nave logística")).select();
    assert.deepEqual([trucar.error, trucar.data], [null, []]);
    assert.equal(a.tablas.obras.some((o) => o.nombre === "hackeada"), false);
    const fich = await luis.from("fichajes").select("*").eq("obra_id", idObra(a, "Nave logística"));
    assert.equal(fich.data.length, 0);
    ok("el manager de la empresa A no ve ni toca nada de la empresa B");
  }

  {
    const a = nuevo();
    const raquel = await como(a, RAQUEL);
    const marta = await como(a, MARTA);
    const propias = await raquel.from("obras").select("id");
    assert.deepEqual(propias.data.map((o: { id: string }) => o.id), [idObra(a, "Olmo")]);
    const gastos = await raquel.from("gastos").select("obra_id");
    assert.ok(gastos.data.length > 0);
    assert.ok(gastos.data.every((g: { obra_id: string }) => g.obra_id === idObra(a, "Olmo")));
    const noCobros = await raquel.from("cobros").select("*");
    assert.equal(noCobros.data.length, 0);
    const marta1 = a.usuarios.find((u) => u.email === MARTA)!.id;
    const ajuste = await marta.from("ajustes").upsert({ owner_id: marta1, jefe_ve_todas: true }, { onConflict: "owner_id" }).select().single();
    assert.equal(ajuste.error, null);
    assert.equal(ajuste.data.jefe_ve_todas, true);
    assert.equal(ajuste.data.jornada_horas, 8); // upsert solo toca las columnas enviadas
    const todas = await raquel.from("obras").select("id");
    assert.equal(todas.data.length, 3);
    ok("el jefe de obra solo ve su obra; con jefe_ve_todas ve todas; nunca ve cobros");
  }

  // --- Gastos ----------------------------------------------------------------
  {
    const a = nuevo();
    const luis = await como(a, LUIS);
    const marta = await como(a, MARTA);
    const olmo = idObra(a, "Olmo");
    const r = await luis.from("gastos").insert({ obra_id: olmo, importe: 20, categoria: "Material", fecha: "2026-11-16", pagado_por: "personal" });
    assert.equal(r.error?.message, "Solo el dueño puede apuntar gastos pagados por él.");
    const propio = a.tablas.gastos.find((g) => g.pagado_por === "personal")!;
    const e = await luis.from("gastos").update({ importe: 1 }).eq("id", propio.id);
    assert.equal(e.error?.message, "Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.");
    const b = await luis.from("gastos").delete().eq("id", propio.id);
    assert.equal(b.error?.message, "Este gasto lo pagó el dueño: solo él puede cambiarlo o borrarlo.");
    const empresa = a.tablas.gastos.find((g) => g.pagado_por === "empresa" && g.obra_id === olmo)!;
    const m = await luis.from("gastos").update({ pagado_por: "personal" }).eq("id", empresa.id);
    assert.equal(m.error?.message, "Solo el dueño puede marcar un gasto como pagado por él.");
    const bien = await luis.from("gastos").insert({ obra_id: olmo, importe: 20.456, categoria: "Material", fecha: "2026-11-16" }).select().single();
    assert.equal(bien.error, null);
    assert.equal(bien.data.importe, 20.46);
    assert.equal(bien.data.pagado_por, "empresa");
    const dueno = await marta.from("gastos").update({ importe: 2 }).eq("id", propio.id).select().single();
    assert.equal(dueno.error, null);
    ok("gastos: las tres reglas de pagado_por con textos exactos; el dueño sí puede");

    const mal = await marta.from("gastos").insert({ obra_id: olmo, importe: 3, categoria: "Otros", fecha: "2026-11-16", pagado_por: "otro" });
    assert.equal(mal.error?.code, "23514");
    const cobro = await marta.from("cobros").insert({ obra_id: olmo, importe: 0, fecha: "2026-11-16" });
    assert.equal(cobro.error?.code, "23514");
    assert.match(cobro.error!.message, /cobros_importe_positivo/);
    const tarea = await marta.from("tareas").insert({ obra_id: olmo, nombre: "x", fecha_inicio: "2026-11-20", fecha_fin: "2026-11-19" });
    assert.match(tarea.error!.message, /tareas_fechas_check/);
    const turno = await marta.from("obras").insert({ owner_id: a.usuarios.find((u) => u.email === MARTA)!.id, nombre: "x", hora_inicio_turno: "25:00" });
    assert.match(turno.error!.message, /obras_hora_inicio_turno_check/);
    ok("restricciones CHECK con código 23514");
  }

  // --- Defaults ---------------------------------------------------------------
  {
    const a = nuevo();
    const marta = await como(a, MARTA);
    const owner = a.usuarios.find((u) => u.email === MARTA)!.id;
    const r = await marta.from("obras").insert({ owner_id: owner, nombre: "Obra nueva" }).select().single();
    assert.equal(r.error, null);
    assert.equal(r.data.empresa_id, a.tablas.empresas.find((e) => e.nombre === "Reformas Salvia")!.id);
    assert.equal(r.data.radio_metros, 150);
    assert.equal(r.data.minutos_antes_permitidos, 30);
    assert.equal(r.data.activa, true);
    assert.match(r.data.id, /^[0-9a-f-]{36}$/);
    assert.equal(r.data.created_at, BASE.toISOString());
    const sinCol = await marta.from("obras").insert({ owner_id: owner, nombre: "x", inexistente: 1 });
    assert.equal(sinCol.error?.code, "PGRST204");
    const sinNombre = await marta.from("obras").insert({ owner_id: owner });
    assert.equal(sinNombre.error?.code, "23502");
    const prov = await marta.from("proveedores").insert({ nombre: "Nuevo Proveedor" }).select().single();
    assert.equal(prov.data.owner_id, owner);
    const dup = await marta.from("proveedores").insert({ nombre: "bigmat" });
    assert.equal(dup.error?.code, "23505");
    ok("valores por defecto (empresa, radio, minutos, id, created_at) y errores de columnas");

    // ajustes: sin fila en B -> el cliente lo tolera; el dueño la crea con su empresa
    const ana = await como(a, ANA);
    const vacio = await ana.from("ajustes").select("*").maybeSingle();
    assert.deepEqual([vacio.data, vacio.error], [null, null]);
    const anaId = a.usuarios.find((u) => u.email === ANA)!.id;
    const nuevoAj = await ana.from("ajustes").upsert({ owner_id: anaId, jornada_horas: 7.5 }, { onConflict: "owner_id" }).select().single();
    assert.equal(nuevoAj.data.empresa_id, a.tablas.empresas.find((e) => e.nombre === "Construcciones Ejemplo")!.id);
    assert.equal(nuevoAj.data.jefe_ve_todas, false);
    assert.equal(nuevoAj.data.mod_vehiculos, true);
    ok("ajustes sin fila = nada; el upsert crea la fila con empresa_id del que llama y defaults");
  }

  // --- Vehículos, borrado y FK -----------------------------------------------
  {
    const a = nuevo();
    const luis = await como(a, LUIS);
    const marta = await como(a, MARTA);
    const uso = a.tablas.usos_vehiculo[0];
    const dup = await luis.from("usos_vehiculo").insert({ obra_id: uso.obra_id, vehiculo_id: uso.vehiculo_id, fecha: uso.fecha });
    assert.equal(dup.error?.code, "23505");
    assert.match(dup.error!.message, /usos_vehiculo_vehiculo_fecha_obra_key/);
    const dosObras = a.tablas.usos_vehiculo.filter((u) => u.fecha === "2026-11-16" && u.vehiculo_id === uso.vehiculo_id);
    assert.equal(dosObras.length, 2);
    ok("usos_vehiculo: duplicado 23505; el mismo vehículo en dos obras el mismo día existe");

    const olmo = idObra(a, "Olmo");
    const borrar = await marta.from("obras").delete().eq("id", olmo);
    assert.equal(borrar.error?.code, "23503");
    ok("borrar una obra con datos: restricción de clave foránea (23503)");

    const noDueno = await luis.rpc("eliminar_obra", { p_obra_id: olmo });
    assert.equal(noDueno.error?.message, "Solo el dueño puede borrar una obra definitivamente.");
    const ajena = await marta.rpc("eliminar_obra", { p_obra_id: idObra(a, "Nave logística") });
    assert.equal(ajena.error?.message, "Esa obra no existe o no es de esta empresa.");
    const antesGastos = a.tablas.gastos.length;
    const bien = await marta.rpc("eliminar_obra", { p_obra_id: olmo });
    assert.equal(bien.error, null);
    assert.equal(a.tablas.obras.some((o) => o.id === olmo), false);
    assert.ok(a.tablas.gastos.length < antesGastos);
    assert.equal(a.tablas.fichajes.some((f) => f.obra_id === olmo), false);
    assert.equal(a.tablas.fichajes_historial.some((f) => f.obra_id === olmo), false);
    assert.equal(a.tablas.miembros.find((m) => m.email === RAQUEL)!.obra_id, null);
    assert.equal(a.tablas.entregas.some((e) => e.obra_id === olmo), false);
    ok("eliminar_obra: errores exactos y borrado en cascada manual (SET NULL en miembros/entregas)");
  }

  // --- Empresa caducada -------------------------------------------------------
  {
    const a = nuevo();
    const gloria = await como(a, GLORIA);
    const obras = await gloria.from("obras").select("*");
    assert.equal(obras.data.length, 0);
    const emp = await gloria.from("empresas").select("*");
    assert.equal(emp.data.length, 1);
    assert.ok(Date.parse(emp.data[0].activa_hasta) < BASE.getTime());
    const yo = await gloria.from("miembros").select("*");
    assert.equal(yo.data.length, 1);
    const alta = await gloria.from("obras").insert({ owner_id: a.usuarios.find((u) => u.email === GLORIA)!.id, nombre: "x" });
    assert.equal(alta.error?.code, "42501");
    const nombre = await gloria.rpc("guardar_mi_nombre", { nuevo: "Gloria R." });
    assert.equal(nombre.error, null);
    assert.equal(a.tablas.miembros.find((m) => m.email === GLORIA)!.nombre, "Gloria R.");
    ok("una empresa caducada no lee nada salvo su empresa y su propia fila");

    // pendiente: solo su fila
    const pendiente = await como(a, "pablo.reyes@reformas-salvia.invalid");
    assert.equal((await pendiente.from("miembros").select("*")).data.length, 1);
    assert.equal((await pendiente.from("empresas").select("*")).data.length, 0);
    assert.equal((await pendiente.from("obras").select("*")).data.length, 0);
    ok("una cuenta pendiente solo ve su propia fila de miembros");
  }

  // --- Códigos de registro y signUp ------------------------------------------
  {
    const a = nuevo();
    const anon = cliente(a);
    const e = await anon.rpc("comprobar_codigo_registro", { p_codigo: "5a1f-0a01" });
    assert.deepEqual(e.data, [{ tipo: "empresa", nombre: "Reformas Salvia" }]);
    const l = await anon.rpc("comprobar_codigo_registro", { p_codigo: "h7kq 2mxd 9pwt" });
    assert.deepEqual(l.data, [{ tipo: "alta", nombre: null }]);
    for (const malo of ["", "ZZZZ-ZZZZ-ZZZZ", "R4NB-6YCE-3JVG", "C2XS-7LPA-8QRN"]) {
      assert.deepEqual((await anon.rpc("comprobar_codigo_registro", { p_codigo: malo })).data, [], malo);
    }
    ok("comprobar_codigo_registro: empresa, alta libre y vacío (inválido, usado, cancelado)");

    const s = await anon.auth.signUp({
      email: "Eva.Prado@Correo.invalid",
      password: "abcdef",
      options: { data: { empresa_codigo: "5A1F0A01", nombre: "Eva", apellidos: "Prado" } },
    });
    assert.equal(s.error, null);
    assert.equal(s.data.session, null);
    const m = a.tablas.miembros.find((x) => x.email === "eva.prado@correo.invalid")!;
    assert.equal(m.rol, "trabajador");
    assert.equal(m.aprobado, false);
    assert.equal(m.nombre, "Eva Prado");
    assert.equal(m.empresa_id, a.tablas.empresas.find((x) => x.nombre === "Reformas Salvia")!.id);
    const sin = await anon.auth.signInWithPassword({ email: "eva.prado@correo.invalid", password: "abcdef" });
    assert.equal(sin.error?.message, "Email not confirmed");
    confirmarEmail(a, "eva.prado@correo.invalid");
    const con = await anon.auth.signInWithPassword({ email: "eva.prado@correo.invalid", password: "abcdef" });
    assert.equal(con.error, null);
    assert.equal((await anon.from("obras").select("*")).data.length, 0);
    ok("signUp con código de empresa: trabajador pendiente; correo sin confirmar no entra");

    const nuevaA = cliente(a);
    const dueno = await nuevaA.auth.signUp({
      email: "nuevo.dueno@correo.invalid",
      password: "abcdef",
      options: { data: { codigo_alta: "h7kq2mxd9pwt", nombre: "Nuria", apellidos: "Lago", nombre_empresa: "  Obras Nuria  " } },
    });
    assert.equal(dueno.error, null);
    const md = a.tablas.miembros.find((x) => x.email === "nuevo.dueno@correo.invalid")!;
    assert.equal(md.rol, "dueno");
    assert.equal(md.aprobado, true);
    const emp = a.tablas.empresas.find((x) => x.id === md.empresa_id)!;
    assert.equal(emp.nombre, "Obras Nuria");
    assert.equal(Math.round((Date.parse(String(emp.activa_hasta)) - BASE.getTime()) / 86400000), 14);
    const codigo = a.tablas.codigos_alta.find((x) => x.codigo === "H7KQ-2MXD-9PWT")!;
    assert.ok(codigo.usado_en && codigo.usado_por && codigo.empresa_id === emp.id);
    const reuso = await cliente(a).auth.signUp({ email: "otro@correo.invalid", password: "abcdef", options: { data: { codigo_alta: "H7KQ-2MXD-9PWT" } } });
    assert.equal(reuso.error?.message, "codigo_alta_invalido");
    const sinCodigo = await cliente(a).auth.signUp({ email: "sin@correo.invalid", password: "abcdef" });
    assert.equal(sinCodigo.error?.message, "codigo_requerido");
    const malo = await cliente(a).auth.signUp({ email: "malo@correo.invalid", password: "abcdef", options: { data: { empresa_codigo: "NOEXISTE1" } } });
    assert.equal(malo.error?.message, "codigo_empresa_invalido");
    assert.equal(a.usuarios.some((u) => u.email === "malo@correo.invalid" || u.email === "sin@correo.invalid" || u.email === "otro@correo.invalid"), false);
    ok("signUp con código de alta: empresa nueva con 14 días, código de un solo uso, errores del trigger");
  }

  // --- single / maybeSingle / count / orden ----------------------------------
  {
    const a = nuevo();
    const marta = await como(a, MARTA);
    const ninguna = await marta.from("obras").select("*").eq("id", "00000000-0000-4000-8000-00000000dead").maybeSingle();
    assert.deepEqual([ninguna.data, ninguna.error], [null, null]);
    const single0 = await marta.from("obras").select("*").eq("id", "00000000-0000-4000-8000-00000000dead").single();
    assert.equal(single0.error?.code, "PGRST116");
    assert.equal(single0.error?.message, "JSON object requested, multiple (or no) rows returned");
    const single3 = await marta.from("obras").select("*").single();
    assert.equal(single3.error?.code, "PGRST116");
    const many = await marta.from("obras").select("*").maybeSingle();
    assert.equal(many.error?.code, "PGRST116");
    const uno = await marta.from("obras").select("nombre").eq("activa", false).single();
    assert.deepEqual(Object.keys(uno.data), ["nombre"]);
    ok("single() y maybeSingle(): 0, 1 y varias filas");

    const c = await marta.from("obras").select("*", { count: "exact", head: true });
    assert.equal(c.data, null);
    assert.equal(c.count, 3);
    assert.equal(c.error, null);
    const c2 = await marta.from("gastos").select("id", { count: "exact" }).eq("pagado_por", "personal").limit(1);
    assert.equal(c2.data.length, 1);
    assert.ok(c2.count! > 1);
    ok("count: 'exact' con head y con limit");

    const g = await marta.from("gastos").select("fecha,importe").gte("fecha", "2026-10-01").lt("fecha", "2026-11-01").order("fecha", { ascending: false }).order("importe");
    assert.ok(g.data.length > 0);
    for (let i = 1; i < g.data.length; i++) assert.ok(g.data[i - 1].fecha >= g.data[i].fecha);
    assert.ok(g.data.every((x: { fecha: string }) => x.fecha >= "2026-10-01" && x.fecha < "2026-11-01"));
    const fuera = await marta.from("gastos").select("id").not("recibo_path", "is", null).in("categoria", ["Material"]);
    assert.ok(fuera.data.length > 0);
    const sinRecibo = await marta.from("gastos").select("id").is("recibo_path", null).neq("categoria", "Material");
    assert.ok(sinRecibo.data.length > 0);
    const col = await marta.from("gastos").select("nope");
    assert.equal(col.error?.code, "42703");
    ok("filtros eq/neq/gte/lt/in/is/not y orden múltiple");

    const av = await marta.rpc("avance_obra", { o_id: idObra(a, "Olmo") });
    assert.ok(typeof av.data === "number" && av.data > 40 && av.data < 80);
    const sinTareas = await marta.rpc("avance_obra", { o_id: a.tablas.obras.find((o) => String(o.nombre).includes("Nave"))!.id });
    assert.equal(sinTareas.data, null);
    ok("avance_obra: media ponderada por días; null si no se puede ver la obra");
  }

  // --- Soporte y admin -------------------------------------------------------
  {
    const a = nuevo();
    const soporte = await como(a, SOPORTE);
    assert.equal((await soporte.from("obras").select("*")).data.length, 3);
    horaMadrid("10:30", "2026-11-20");
    assert.equal((await soporte.from("obras").select("*")).data.length, 0);
    ahora = BASE;
    const marta = await como(a, MARTA);
    assert.equal((await soporte.from("obras").select("*")).data.length, 3);
    const accesos = await marta.from("soporte_accesos").select("*");
    assert.equal(accesos.data.length, 1);
    const rev = await marta.rpc("revocar_acceso_soporte", { acceso_id: accesos.data[0].id });
    assert.equal(rev.error, null);
    assert.equal((await soporte.from("obras").select("*")).data.length, 0);
    const horas = await marta.rpc("dar_acceso_soporte", { email_soporte: SOPORTE, horas: 0 });
    assert.equal(horas.error?.message, "Las horas tienen que ser entre 1 y 720 (30 días).");
    const real = await marta.rpc("dar_acceso_soporte", { email_soporte: LUIS });
    assert.equal(real.error?.message, "Esa cuenta ya es miembro real de una empresa; usa una cuenta aparte para el soporte.");
    const nadie = await marta.rpc("dar_acceso_soporte", { email_soporte: "nadie@x.invalid" });
    assert.equal(nadie.error?.message, "Esa cuenta todavía no existe: tiene que registrarse primero en la app.");
    const dar = await marta.rpc("dar_acceso_soporte", { email_soporte: SOPORTE, horas: 2 });
    assert.equal(dar.error, null);
    assert.equal((await soporte.from("obras").select("*")).data.length, 3);
    const luis = await como(a, LUIS);
    assert.equal((await luis.rpc("dar_acceso_soporte", { email_soporte: SOPORTE })).error?.message, "Solo el dueño puede dar acceso de soporte.");
    ok("acceso de soporte: caduca, se revoca y se vuelve a dar; errores exactos");
  }

  {
    const a = nuevo();
    const admin = await como(a, ADMIN);
    const marta = await como(a, MARTA);
    assert.equal((await admin.rpc("soy_admin_plataforma")).data, true);
    assert.equal((await marta.rpc("soy_admin_plataforma")).data, false);
    const emp = await admin.rpc("listar_empresas_admin");
    assert.equal(emp.data.length, 3);
    const salvia = emp.data.find((e: { nombre: string }) => e.nombre === "Reformas Salvia");
    assert.equal(salvia.miembros_count, 6); // sin la cuenta de soporte
    assert.equal(salvia.obras_count, 3);
    assert.equal(salvia.codigo_alta, "R4NB-6YCE-3JVG");
    assert.deepEqual((await marta.rpc("listar_empresas_admin")).data, []);
    assert.deepEqual((await marta.rpc("listar_codigos_alta")).data, []);
    assert.deepEqual((await marta.rpc("listar_errores_admin")).data, []);
    const nuevo1 = await admin.rpc("crear_codigo_alta", { p_nota: "  prueba  " });
    assert.match(nuevo1.data, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const lista = await admin.rpc("listar_codigos_alta");
    const fila = lista.data.find((c: { codigo: string }) => c.codigo === nuevo1.data);
    assert.deepEqual([fila.estado, fila.nota, fila.pagado], ["libre", "prueba", false]);
    assert.deepEqual(lista.data.map((c: { estado: string }) => c.estado).sort(), ["cancelado", "libre", "libre", "libre", "usado", "usado"]);
    await admin.rpc("cancelar_codigo_alta", { p_id: fila.id });
    assert.equal((await admin.rpc("listar_codigos_alta")).data.find((c: { id: string }) => c.id === fila.id).estado, "cancelado");
    for (const [nombre, args] of [["crear_codigo_alta", {}], ["cancelar_codigo_alta", { p_id: fila.id }], ["borrar_errores_admin", {}], ["establecer_suscripcion", { p_empresa: salvia.id, p_activa_hasta: null, p_bloqueada: false }]] as const) {
      assert.equal((await marta.rpc(nombre, args)).error?.message, "no autorizado", nombre);
    }
    await admin.rpc("establecer_suscripcion", { p_empresa: salvia.id, p_activa_hasta: null, p_bloqueada: true });
    assert.equal((await marta.from("obras").select("*")).data.length, 0);
    const errs = await admin.rpc("listar_errores_admin", { p_limite: 2 });
    assert.equal(errs.data.length, 2);
    assert.ok(Date.parse(errs.data[0].creado_en) >= Date.parse(errs.data[1].creado_en));
    await admin.rpc("borrar_errores_admin");
    assert.equal((await admin.rpc("listar_errores_admin")).data.length, 0);
    ok("RPC de administración: listas vacías y 'no autorizado' para no admins, formato de código");

    const anon = cliente(a);
    await anon.auth.signOut();
    const e = await anon.rpc("registrar_error", { p_origen: "otro", p_mensaje: "   ", p_ruta: "/x" });
    assert.equal(e.error, null);
    const ult = a.tablas.errores_app[a.tablas.errores_app.length - 1];
    assert.deepEqual([ult.origen, ult.mensaje, ult.user_id, ult.empresa_id], ["navegador", "(sin mensaje)", null, null]);
    const larga = "x".repeat(900);
    await anon.rpc("registrar_error", { p_origen: "servidor", p_mensaje: larga });
    assert.equal(String(a.tablas.errores_app[a.tablas.errores_app.length - 1].mensaje).length, 500);
    const privado = await anon.rpc("registrar_pago_alta", { p_session: "x" });
    assert.equal(privado.error?.code, "42501");
    ok("registrar_error sin sesión: origen, mensaje vacío y recorte; RPC de servicio protegidas");
  }

  // --- Storage ---------------------------------------------------------------
  {
    const a = nuevo();
    const marta = await como(a, MARTA);
    const diego = await como(a, DIEGO);
    const luis = await como(a, LUIS);
    const olmo = idObra(a, "Olmo");
    const blob = new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" });
    const sube = await marta.storage.from("facturas").upload(`${olmo}/nuevo.svg`, blob, { contentType: "image/svg+xml" });
    assert.deepEqual([sube.error, sube.data?.path], [null, `${olmo}/nuevo.svg`]);
    const dup = await marta.storage.from("facturas").upload(`${olmo}/nuevo.svg`, blob);
    assert.equal(dup.error?.message, "The resource already exists");
    const firma = await luis.storage.from("facturas").createSignedUrl(`${olmo}/nuevo.svg`, 3600);
    assert.match(firma.data!.signedUrl, /^data:image\/svg\+xml/);
    const denegada = await diego.storage.from("facturas").createSignedUrl(`${olmo}/nuevo.svg`, 60);
    assert.ok(denegada.error);
    const subeTrab = await diego.storage.from("facturas").upload(`${olmo}/otro.svg`, blob);
    assert.equal(subeTrab.error?.message, "new row violates row-level security policy");
    const ajena = await marta.storage.from("facturas").upload(`${idObra(a, "Nave")}/x.svg`, blob);
    assert.ok(ajena.error);
    const raro = await marta.storage.from("facturas").upload("no-uuid/x.svg", blob);
    assert.match(raro.error!.message, /invalid input syntax for type uuid/);
    const conRecibo = (await marta.from("gastos").select("recibo_path").not("recibo_path", "is", null).limit(1).single()).data.recibo_path;
    assert.ok((await marta.storage.from("facturas").createSignedUrl(conRecibo, 60)).data!.signedUrl.startsWith("data:image/svg+xml"));
    const nota = (await marta.from("notas_audio").select("audio_path").limit(1).single()).data.audio_path;
    assert.ok((await marta.storage.from("notas").createSignedUrl(nota, 60)).data!.signedUrl.startsWith("data:audio/wav;base64,"));
    const quita = await diego.storage.from("facturas").remove([`${olmo}/nuevo.svg`]);
    assert.deepEqual(quita.data, []);
    const quita2 = await marta.storage.from("facturas").remove([`${olmo}/nuevo.svg`]);
    assert.equal(quita2.data!.length, 1);
    ok("storage: permisos por obra, duplicados, URL firmada cargable, trabajadores sin acceso");
  }

  // --- Modos de red, persistencia, alCambiar ---------------------------------
  {
    const a = nuevo();
    let modo: ModoRed = "normal";
    let cambios = 0;
    const db = cliente(a, { red: () => modo, alCambiar: () => cambios++ });
    await db.auth.signInWithPassword({ email: MARTA, password: CLAVE_DEMO });
    cambios = 0;

    await db.from("obras").select("*");
    await db.rpc("avance_obra", { o_id: idObra(a, "Olmo") });
    assert.equal(cambios, 0);
    await db.from("proveedores").insert({ nombre: "Otro más" });
    assert.equal(cambios, 1);
    await db.from("proveedores").insert({ nombre: "otro MÁS" }); // choca: no hay cambio
    assert.equal(cambios, 1);
    ok("alCambiar se llama solo tras escrituras correctas");

    modo = "error";
    const e = await db.from("obras").select("*");
    assert.deepEqual([e.data, e.error?.message], [null, "Error de prueba: el servidor no responde."]);
    assert.equal((await db.rpc("soy_admin_plataforma")).error?.message, "Error de prueba: el servidor no responde.");
    modo = "sin-conexion";
    const s = await db.from("obras").select("*");
    assert.deepEqual([s.data, s.error?.message], [null, "TypeError: Failed to fetch"]);
    assert.equal((await db.storage.from("notas").remove(["x"])).error?.message, "TypeError: Failed to fetch");
    modo = "cargando";
    const PENDIENTE = Symbol("pendiente");
    const r = await Promise.race([db.from("obras").select("*"), new Promise((res) => setTimeout(() => res(PENDIENTE), 60))]);
    assert.equal(r, PENDIENTE);
    modo = "normal";
    assert.equal((await db.from("obras").select("*")).data.length, 3);
    ok("modos de red: error, sin-conexión, cargando (nunca resuelve) y vuelta a normal");

    const t0 = Date.now();
    await cliente(a, { }).from("obras").select("*");
    const lento = crearClienteMemoria({ almacen: a, latenciaMs: 80 });
    const t1 = Date.now();
    await lento.from("obras").select("*");
    assert.ok(Date.now() - t1 >= 70);
    void t0;
    ok("latencia artificial");

    const copia = deserializarAlmacen(serializarAlmacen(a));
    assert.deepEqual(copia.tablas, a.tablas);
    assert.deepEqual(copia.archivos, a.archivos);
    assert.equal(copia.sesion?.user_id, a.sesion?.user_id);
    const db2 = crearClienteMemoria({ almacen: copia, reloj: () => ahora });
    assert.equal((await db2.auth.getSession()).data.session?.user.email, MARTA);
    assert.equal((await db2.from("obras").select("*")).data.length, 3);
    ok("el almacén se serializa y se recupera (con sesión y archivos)");
  }

  // --- Escenarios ------------------------------------------------------------
  {
    const v = crearAlmacen("vacio", BASE);
    assert.equal(v.tablas.obras.length, 0);
    assert.equal(v.tablas.fichajes.length, 0);
    assert.ok(v.tablas.miembros.length >= 12);
    const marta = crearClienteMemoria({ almacen: v, reloj: () => BASE });
    await marta.auth.signInWithPassword({ email: MARTA, password: CLAVE_DEMO });
    assert.equal((await marta.from("obras").select("*")).data.length, 0);
    const l = crearAlmacen("textos-largos", BASE);
    assert.ok(l.tablas.obras.some((o) => String(o.nombre).startsWith("Rehabilitación integral del edificio residencial de la calle Mayor número 128, bloque B")));
    assert.ok(l.tablas.trabajadores.every((t) => String(t.nombre).length > 30) === true);
    ok("escenarios 'vacio' y 'textos-largos'");
  }

  console.log("✓ Todas las comprobaciones de la base en memoria son correctas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
