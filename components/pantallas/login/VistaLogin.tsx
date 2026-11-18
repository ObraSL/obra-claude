"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { Logo } from "@/components/marca/Logo";
import { FotoObra } from "@/components/marca/FotoObra";
import { Boton } from "@/components/ui/Boton";
import { Campo, Entrada } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Aviso";
import { SelectorIdioma } from "@/components/ui/SelectorIdioma";

export type ModoLogin = "login" | "signup" | "recuperar";
export type InfoCodigo =
  | { estado: "vacio" | "comprobando" | "invalido" }
  | { estado: "empresa"; nombre: string }
  | { estado: "alta" };

export const ID_PASSWORD = "login-password";

/**
 * Vista pura de /login (ACC-02…ACC-05, ACC-13): no sabe nada de datos; todo
 * le llega por props (así la galería la pinta en cualquier estado).
 */
export type PropsVistaLogin = {
  modo: ModoLogin;
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  nombreEmpresa: string;
  codigo: string;
  codigoInfo: InfoCodigo;
  cargando: boolean;
  error: string;
  /** El error es «contraseña incorrecta»: se añade la pista del email (en v1 solo salía en español). */
  claveIncorrecta: boolean;
  aviso: string;
  onCampo: (campo: "email" | "password" | "nombre" | "apellidos" | "nombreEmpresa" | "codigo", valor: string) => void;
  onModo: (m: ModoLogin) => void;
  onEnviar: (e: FormEvent) => void;
  /** Bloque extra bajo el formulario (solo el modo demo lo usa). */
  extra?: ReactNode;
};

export function VistaLogin(p: PropsVistaLogin) {
  const codigoValido = p.codigoInfo.estado === "empresa" || p.codigoInfo.estado === "alta";
  return (
    <main className="mx-auto w-full max-w-md md:grid md:min-h-[100dvh] md:max-w-5xl md:grid-cols-[1.05fr_1fr] md:items-center md:gap-10 md:px-8">
      {/* La obra, arriba (como el «Welcome» de la referencia): la foto sangra hasta los
          bordes en el móvil y en el ordenador se pone a un lado, sin fundido. */}
      <div className="relative md:self-center">
        <FotoObra prioritaria className="h-[20rem] md:h-[min(37rem,88dvh)] md:rounded-panel foto-obra--plena-md" />
        {/* En la app instalada no hay barra del navegador: sin esta flecha no
            se podría volver a la pantalla de inicio (T-12). */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-5 pt-[max(env(safe-area-inset-top),16px)] md:px-4 md:pt-4">
          <Link
            href="/"
            aria-label={tr("Volver")}
            className="inline-flex size-11 items-center justify-center rounded-[8px] bg-[rgb(20_22_19/0.55)] text-white backdrop-blur-md hover:brightness-110"
          >
            <ArrowLeft size={20} aria-hidden />
          </Link>
          <SelectorIdioma />
        </div>
      </div>

      <div className="relative -mt-24 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:mt-0 md:px-0 md:pb-0">
        <Logo compacto />
        <h1 className="mt-3 texto-sobre-foto text-cifra font-light tracking-[-0.03em]">Control de Obra</h1>
        <p className="texto-sobre-foto mt-1 text-base">
          {p.modo === "login" ? tr("Iniciar sesión") : p.modo === "signup" ? tr("Crear cuenta") : tr("¿Olvidaste tu contraseña?")}
        </p>

        <div className="vidrio mt-4 rounded-panel p-4">
      <form onSubmit={p.onEnviar} className="grid gap-3.5" noValidate={false}>
        <Campo etiqueta={tr("Email")} htmlFor="login-email">
          <Entrada
            id="login-email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={p.email}
            onChange={(e) => p.onCampo("email", e.target.value)}
            placeholder={tr("tú@ejemplo.com")}
          />
        </Campo>

        {p.modo === "signup" && (
          <>
            <Campo etiqueta={tr("Nombre")} htmlFor="login-nombre">
              <Entrada
                id="login-nombre"
                required
                autoComplete="given-name"
                value={p.nombre}
                onChange={(e) => p.onCampo("nombre", e.target.value)}
                placeholder={tr("Ej. Ana")}
              />
            </Campo>
            <Campo etiqueta={tr("Apellidos")} htmlFor="login-apellidos">
              <Entrada
                id="login-apellidos"
                required
                autoComplete="family-name"
                value={p.apellidos}
                onChange={(e) => p.onCampo("apellidos", e.target.value)}
                placeholder={tr("Ej. Pérez López")}
              />
            </Campo>
          </>
        )}

        {p.modo !== "recuperar" && (
          <Campo etiqueta={tr("Contraseña")} htmlFor={ID_PASSWORD}>
            <Entrada
              id={ID_PASSWORD}
              type="password"
              required
              minLength={6}
              autoComplete={p.modo === "signup" ? "new-password" : "current-password"}
              value={p.password}
              onChange={(e) => p.onCampo("password", e.target.value)}
              placeholder="••••••••"
            />
          </Campo>
        )}

        {p.modo === "signup" && (
          <>
            <Campo etiqueta={tr("Código")} htmlFor="login-codigo">
              <Entrada
                id="login-codigo"
                required
                autoCapitalize="characters"
                autoComplete="off"
                value={p.codigo}
                onChange={(e) => p.onCampo("codigo", e.target.value)}
                placeholder={tr("El código que te ha dado tu empresa")}
              />
            </Campo>
            {!codigoValido && (
              <Link href="/alta" className="-mt-1 inline-flex min-h-11 items-center text-peq font-medium underline underline-offset-4">
                {tr("¿Tu empresa aún no tiene código? Consíguelo aquí")}
              </Link>
            )}
            {p.codigoInfo.estado === "comprobando" && (
              <p role="status" className="-mt-1 text-peq">
                {tr("Comprobando el código…")}
              </p>
            )}
            {p.codigoInfo.estado === "invalido" && <Aviso tono="error">{tr("Ese código no vale (o ya se usó). Pídelo de nuevo.")}</Aviso>}
            {p.codigoInfo.estado === "empresa" && (
              <Aviso tono="ok">
                {tr("Te unes a la empresa «{empresa}». Su responsable tendrá que aprobarte.", { empresa: p.codigoInfo.nombre })}
              </Aviso>
            )}
            {p.codigoInfo.estado === "alta" && (
              <>
                <Aviso tono="ok">{tr("Código válido: vas a crear tu propia empresa (14 días de prueba).")}</Aviso>
                <Campo etiqueta={tr("Nombre de tu empresa")} htmlFor="login-empresa">
                  <Entrada
                    id="login-empresa"
                    required
                    autoComplete="organization"
                    value={p.nombreEmpresa}
                    onChange={(e) => p.onCampo("nombreEmpresa", e.target.value)}
                    placeholder={tr("Ej. Reformas Pérez")}
                  />
                </Campo>
              </>
            )}
          </>
        )}

        {/* Bien visible: con el teclado del iPhone abierto, un aviso pequeño
            en gris pasaba desapercibido y parecía que no hacía nada. */}
        {p.error && (
          <Aviso tono="error">
            {p.error}
            {p.claveIncorrecta && <span className="mt-0.5 block font-normal">{tr("Si sigue fallando, revisa que el email esté bien escrito.")}</span>}
          </Aviso>
        )}
        {p.aviso && <Aviso tono="ok">{p.aviso}</Aviso>}

        <Boton type="submit" grande ancho cargando={p.cargando} disabled={p.modo === "signup" && !codigoValido}>
          {p.modo === "login" ? tr("Entrar") : p.modo === "signup" ? tr("Crear cuenta") : tr("Enviar enlace")}
        </Boton>
      </form>

      <div className="mt-3 grid gap-1">
        {p.modo === "login" && (
          <button
            type="button"
            onClick={() => p.onModo("recuperar")}
            className="min-h-11 rounded-boton text-center text-base font-medium underline underline-offset-4"
          >
            {tr("¿Olvidaste tu contraseña?")}
          </button>
        )}
        <button
          type="button"
          onClick={() => p.onModo(p.modo === "login" ? "signup" : "login")}
          className="min-h-11 rounded-boton text-center text-base font-medium underline underline-offset-4"
        >
          {p.modo === "login"
            ? tr("¿No tienes cuenta? Créala")
            : p.modo === "signup"
              ? tr("¿Ya tienes cuenta? Inicia sesión")
              : tr("Volver a iniciar sesión")}
        </button>
      </div>
        </div>

        {p.extra}
      </div>
    </main>
  );
}
