/* ── Utilidades de roles: navegación y rutas filtradas por rol ── */

import { Rol, type IUser } from '@pos-final/types';

/** Etiqueta legible por rol (misma fuente que ROL_LABELS en EmpleadasPage). */
export const ROL_LABELS: Record<number, string> = {
  [Rol.SUPERADMIN]: 'Superadmin',
  [Rol.DUEÑA]: 'Dueña',
  [Rol.ADMINISTRADOR]: 'Administrador',
  [Rol.MANICURISTA]: 'Manicurista',
  [Rol.RECEPCIONISTA]: 'Recepcionista',
  [Rol.CONTADOR]: 'Contador',
};

export function rolLabel(rol: number | null | undefined): string {
  return rol != null ? (ROL_LABELS[rol] ?? 'Usuario') : 'Usuario';
}

/* ── Roles privilegiados: reportes, P&L, export y cuentas ── */

/**
 * Espeja `PRIVILEGED_ROLES_LIST` del backend
 * (apps/api/src/presentation/middleware/privilegedRoles.ts). Única fuente para
 * las compuertas de UI: no duplicar la lista en las páginas.
 */
export const PRIVILEGED_ROLES: Rol[] = [
  Rol.SUPERADMIN,
  Rol.DUEÑA,
  Rol.ADMINISTRADOR,
  Rol.CONTADOR,
];

export function isPrivilegedRole(user: IUser | null | undefined): boolean {
  return !!user && PRIVILEGED_ROLES.includes(user.rol);
}

/* ── Páginas permitidas por rol (href de cada ruta del dashboard) ── */

const PAGE_DASHBOARD = '/';
const PAGE_CITAS = '/agenda';
const PAGE_CLIENTES = '/clientes';
const PAGE_SERVICIOS = '/servicios';
const PAGE_EMPLEADOS = '/empleadas';
const PAGE_PRODUCTOS = '/productos';
const PAGE_CATEGORIAS = '/categorias';
const PAGE_VENTAS = '/ventas';
const PAGE_FINANZAS = '/finanzas';
const PAGE_PRESTAMOS = '/prestamos';
const PAGE_HORARIOS = '/horarios';

export const ALL_PAGES = [
  PAGE_DASHBOARD,
  PAGE_CITAS,
  PAGE_CLIENTES,
  PAGE_SERVICIOS,
  PAGE_EMPLEADOS,
  PAGE_PRODUCTOS,
  PAGE_CATEGORIAS,
  PAGE_VENTAS,
  PAGE_FINANZAS,
  PAGE_PRESTAMOS,
  PAGE_HORARIOS,
];

/**
 * Matriz rol → páginas permitidas.
 * MANICURISTA: atención (citas, clientes, servicios y finanzas básicas; sin
 *   dashboard, ventas ni administración).
 * RECEPCIONISTA: front desk (citas, clientes, ventas y finanzas básicas; sin
 *   dashboard, servicios, nómina ni administración).
 * CONTADOR: finanzas y catálogo (sin ventas ni gestión de citas).
 * ADMINISTRADOR / DUEÑA / SUPERADMIN: todo.
 */
export const ROLE_PAGES: Record<number, string[]> = {
  [Rol.SUPERADMIN]: ALL_PAGES,
  [Rol.DUEÑA]: ALL_PAGES,
  [Rol.ADMINISTRADOR]: ALL_PAGES,
  [Rol.MANICURISTA]: [
    PAGE_CITAS,
    PAGE_CLIENTES,
    PAGE_SERVICIOS,
    PAGE_FINANZAS,
  ],
  [Rol.RECEPCIONISTA]: [
    PAGE_CITAS,
    PAGE_CLIENTES,
    PAGE_VENTAS,
    PAGE_FINANZAS,
  ],
  [Rol.CONTADOR]: [
    PAGE_DASHBOARD,
    PAGE_FINANZAS,
    PAGE_CLIENTES,
    PAGE_SERVICIOS,
    PAGE_PRODUCTOS,
    PAGE_CATEGORIAS,
  ],
};

export function canAccessPage(rol: number | null | undefined, href: string): boolean {
  if (rol == null) return false;
  return (ROLE_PAGES[rol] ?? []).includes(href);
}

/**
 * Página de aterrizaje por rol. Los roles operativos
 * (MANICURISTA/RECEPCIONISTA) no pueden ver el Dashboard, así que aterrizan en
 * `/finanzas`; el resto mantiene el Dashboard como landing.
 */
export function defaultPageForRol(rol: number | null | undefined): string {
  if (rol === Rol.MANICURISTA || rol === Rol.RECEPCIONISTA) return PAGE_FINANZAS;
  return PAGE_DASHBOARD;
}

/**
 * Guard de rutas: devuelve la ruta de redirección si el rol NO puede ver la
 * página actual, o null si está permitida. El destino es el landing del rol
 * (`/finanzas` para operativos, `/` para el resto).
 */
export function resolveRouteGuard(rol: number | null | undefined, pathname: string): string | null {
  if (rol == null) return null;
  return canAccessPage(rol, pathname) ? null : defaultPageForRol(rol);
}
