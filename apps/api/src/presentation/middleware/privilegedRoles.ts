import { Rol } from '@pos-final/types';

/**
 * Roles que pueden ver el costo de insumos en Reportes/Registros y acceder a
 * los endpoints privilegiados de reportes (`/finanzas/pyl`, `/finanzas/exportar`).
 *
 * Decisión del owner: el Reportes completo es solo para estos 4 roles.
 * Esta es la ÚNICA fuente de verdad del backend: `ReporteController`,
 * `RegistroController` y los guards de rutas resuelven por acá, de modo que
 * la regla no pueda divergir.
 */
export const PRIVILEGED_ROLES_LIST: readonly Rol[] = [
  Rol.SUPERADMIN,
  Rol.DUEÑA,
  Rol.ADMINISTRADOR,
  Rol.CONTADOR,
];

/** Set derivado de la lista — imposible de desincronizar. */
export const PRIVILEGED_ROLES = new Set<number>(PRIVILEGED_ROLES_LIST);

/** `true` solo para los 4 roles privilegiados; `null`/`undefined` → `false`. */
export function isPrivilegedRole(rol: number | null | undefined): boolean {
  return rol != null && PRIVILEGED_ROLES.has(rol);
}
