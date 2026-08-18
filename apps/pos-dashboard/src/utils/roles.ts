/* ── Utilidades de roles: navegación y rutas filtradas por rol ── */

import { Rol } from '@pos-final/types';

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
 * MANICURISTA: atención (sin finanzas/ventas/administración).
 * RECEPCIONISTA: front desk (ventas, finanzas básicas; sin nómina/prestamos).
 * CONTADOR: finanzas y catálogo (sin ventas ni gestión de citas).
 * ADMINISTRADOR / DUEÑA / SUPERADMIN: todo.
 */
export const ROLE_PAGES: Record<number, string[]> = {
  [Rol.SUPERADMIN]: ALL_PAGES,
  [Rol.DUEÑA]: ALL_PAGES,
  [Rol.ADMINISTRADOR]: ALL_PAGES,
  [Rol.MANICURISTA]: [
    PAGE_DASHBOARD,
    PAGE_CITAS,
    PAGE_CLIENTES,
    PAGE_SERVICIOS,
    PAGE_HORARIOS,
  ],
  [Rol.RECEPCIONISTA]: [
    PAGE_DASHBOARD,
    PAGE_CITAS,
    PAGE_CLIENTES,
    PAGE_VENTAS,
    PAGE_FINANZAS,
    PAGE_HORARIOS,
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
 * Guard de rutas: devuelve la ruta de redirección si el rol NO puede ver la
 * página actual, o null si está permitida. El dashboard ("/") es el destino
 * por defecto de roles sin permiso.
 */
export function resolveRouteGuard(rol: number | null | undefined, pathname: string): string | null {
  if (rol == null) return null;
  return canAccessPage(rol, pathname) ? null : '/';
}
