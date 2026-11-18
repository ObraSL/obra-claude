"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tr } from "@/lib/i18n";
import { MODO_MEMORIA } from "@/lib/datos/db";
import { DatosProvider, useDb } from "@/lib/datos/provider";
import { comprobarCodigoRegistro, iniciarSesion, recuperarContrasena, registrarse } from "@/lib/datos/consultas";
import { ID_PASSWORD, VistaLogin, type InfoCodigo, type ModoLogin } from "@/components/pantallas/login/VistaLogin";

/** Solo el modo demo: lista de cuentas ficticias para entrar con un toque. */
const CuentasDemo = MODO_MEMORIA ? dynamic(() => import("@/components/demo/CuentasDemo"), { ssr: false }) : null;

/**
 * Las cuentas de prueba NO se enseñan a cualquiera que abra /login: solo con el enlace
 * «/login?demo=1» (queda recordado en este navegador; «?demo=0» lo quita). Así un
 * trabajador o un cliente real nunca ve la lista de cuentas ficticias.
 */
const VER_CUENTAS_DEMO = "obra-demo:ver-cuentas";

/** Solo se recuerda el email del último acceso; la contraseña nunca (ACC-02). */
const EMAIL_RECORDADO = "control-de-obra:email";

/** Pone el cursor en la contraseña, para escribirla sin tocar nada más. */
const enfocarPassword = () => requestAnimationFrame(() => document.getElementById(ID_PASSWORD)?.focus());

export default function LoginPage() {
  return (
    <DatosProvider>
      {/* useSearchParams exige un límite de Suspense (T-21). */}
      <Suspense fallback={null}>
        <LoginContenedor />
      </Suspense>
    </DatosProvider>
  );
}

function LoginContenedor() {
  const router = useRouter();
  const db = useDb();
  const params = useSearchParams();
  // ?empresa= (invitación de una empresa) o ?alta= (vuelta del pago en /alta): ACC-04.
  const codigoEnlace = params.get("empresa") ?? params.get("alta");

  const [modo, setModo] = useState<ModoLogin>(codigoEnlace || params.get("registro") ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [codigo, setCodigo] = useState(codigoEnlace ?? "");
  const [codigoInfo, setCodigoInfo] = useState<InfoCodigo>({ estado: "vacio" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [claveIncorrecta, setClaveIncorrecta] = useState(false);
  const [aviso, setAviso] = useState("");
  const [verDemo, setVerDemo] = useState(false);
  const demoEnEnlace = params.get("demo");

  useEffect(() => {
    try {
      if (demoEnEnlace === "1") localStorage.setItem(VER_CUENTAS_DEMO, "1");
      else if (demoEnEnlace === "0") localStorage.removeItem(VER_CUENTAS_DEMO);
      setVerDemo(localStorage.getItem(VER_CUENTAS_DEMO) === "1");
    } catch {
      setVerDemo(demoEnEnlace === "1");
    }
  }, [demoEnEnlace]);

  // Cada vez que cambia el código se consulta qué es (con 400 ms de pausa
  // para no preguntar por cada letra) y se enseña antes de crear la cuenta.
  useEffect(() => {
    const limpio = codigo.trim();
    if (!limpio) {
      setCodigoInfo({ estado: "vacio" });
      return;
    }
    setCodigoInfo({ estado: "comprobando" });
    let cancelado = false;
    const t = setTimeout(() => {
      comprobarCodigoRegistro(db, limpio).then(({ data }) => {
        if (cancelado) return;
        const fila = data?.[0];
        if (fila?.tipo === "empresa") setCodigoInfo({ estado: "empresa", nombre: fila.nombre ?? "" });
        else if (fila?.tipo === "alta") setCodigoInfo({ estado: "alta" });
        else setCodigoInfo({ estado: "invalido" });
      });
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [codigo, db]);

  useEffect(() => {
    const guardado = localStorage.getItem(EMAIL_RECORDADO);
    if (guardado) {
      setEmail(guardado);
      // Con el email ya puesto, lo único que falta es la contraseña.
      enfocarPassword();
    }
  }, []);

  const limpiarMensajes = () => {
    setError("");
    setClaveIncorrecta(false);
    setAviso("");
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    limpiarMensajes();
    setCargando(true);

    if (modo === "login") {
      const { error: err } = await iniciarSesion(db, email, password);
      if (err) {
        if (err.message === "Invalid login credentials") {
          // Se queda en esta pantalla y con el email escrito: solo se borra
          // la contraseña mala y el cursor vuelve a ella para repetirla.
          setError(tr("Contraseña incorrecta. Vuelve a escribirla."));
          setClaveIncorrecta(true);
          setPassword("");
          enfocarPassword();
        } else if (err.message === "Email not confirmed") {
          setError(tr("Todavía no has confirmado tu email. Busca el correo de confirmación."));
        } else {
          setError(err.message);
        }
        setCargando(false);
        return;
      }
      localStorage.setItem(EMAIL_RECORDADO, email);
      router.push("/");
      router.refresh();
    } else if (modo === "signup") {
      const { error: err } = await registrarse(
        db,
        email,
        password,
        codigoInfo.estado === "empresa"
          ? { empresa_codigo: codigo.trim(), nombre: nombre.trim(), apellidos: apellidos.trim() }
          : {
              codigo_alta: codigo.trim(),
              nombre_empresa: nombreEmpresa.trim(),
              nombre: nombre.trim(),
              apellidos: apellidos.trim(),
            }
      );
      if (err) {
        setError(err.message);
        setCargando(false);
        return;
      }
      setAviso(tr("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión."));
      setModo("login");
      setCargando(false);
    } else {
      const { error: err } = await recuperarContrasena(db, email);
      if (err) {
        setError(err.message);
        setCargando(false);
        return;
      }
      // No revela si el email existe (ACC-05).
      setAviso(tr("Si ese email tiene una cuenta, te hemos enviado un enlace para restablecer la contraseña."));
      setCargando(false);
    }
  };

  return (
    <VistaLogin
      modo={modo}
      email={email}
      password={password}
      nombre={nombre}
      apellidos={apellidos}
      nombreEmpresa={nombreEmpresa}
      codigo={codigo}
      codigoInfo={codigoInfo}
      cargando={cargando}
      error={error}
      claveIncorrecta={claveIncorrecta}
      aviso={aviso}
      onCampo={(campo, valor) => {
        if (campo === "email") setEmail(valor);
        else if (campo === "password") {
          setPassword(valor);
          if (error) limpiarMensajes();
        } else if (campo === "nombre") setNombre(valor);
        else if (campo === "apellidos") setApellidos(valor);
        else if (campo === "nombreEmpresa") setNombreEmpresa(valor);
        else setCodigo(valor);
      }}
      onModo={(m) => {
        setModo(m);
        limpiarMensajes();
      }}
      onEnviar={enviar}
      extra={
        CuentasDemo && verDemo && modo === "login" ? (
          <CuentasDemo
            onElegir={(correo, clave) => {
              setEmail(correo);
              setPassword(clave);
              limpiarMensajes();
            }}
            onEntrar={async (correo, clave) => {
              limpiarMensajes();
              setCargando(true);
              const { error: err } = await iniciarSesion(db, correo, clave);
              if (err) {
                setError(err.message);
                setCargando(false);
                return;
              }
              localStorage.setItem(EMAIL_RECORDADO, correo);
              router.push("/");
              router.refresh();
            }}
          />
        ) : undefined
      }
    />
  );
}
