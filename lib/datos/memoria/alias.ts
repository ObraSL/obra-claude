/**
 * Los DOS accesos para comparar roles en la demo (D-16): un correo fácil de escribir
 * para el dueño y otro para un trabajador. No son cuentas nuevas: apuntan a las que ya
 * están en la semilla (con sus mismos datos y permisos). Contraseña: la de la demo.
 */
export const EMAIL_DIRECTOR_DEMO = "director@demo.invalid";
export const EMAIL_TRABAJADOR_DEMO = "trabajador@demo.invalid";

export const ALIAS_DEMO: Record<string, string> = {
  [EMAIL_DIRECTOR_DEMO]: "marta.salvia@reformas-salvia.invalid",
  [EMAIL_TRABAJADOR_DEMO]: "diego.navarro@reformas-salvia.invalid",
};
