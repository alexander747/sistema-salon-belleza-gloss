import { describe, it, expect } from 'vitest';
import { Rol, type IUser } from '@pos-final/types';
import {
  ROL_LABELS,
  rolLabel,
  ALL_PAGES,
  canAccessPage,
  resolveRouteGuard,
  PRIVILEGED_ROLES,
  isPrivilegedRole,
} from './roles';

describe('roles — etiquetas legibles', () => {
  it('mapea cada rol a su etiqueta en español', () => {
    expect(ROL_LABELS[Rol.SUPERADMIN]).toBe('Superadmin');
    expect(ROL_LABELS[Rol.DUEÑA]).toBe('Dueña');
    expect(ROL_LABELS[Rol.ADMINISTRADOR]).toBe('Administrador');
    expect(ROL_LABELS[Rol.MANICURISTA]).toBe('Manicurista');
    expect(ROL_LABELS[Rol.RECEPCIONISTA]).toBe('Recepcionista');
    expect(ROL_LABELS[Rol.CONTADOR]).toBe('Contador');
  });

  it('rolLabel devuelve "Usuario" para roles desconocidos/null', () => {
    expect(rolLabel(null)).toBe('Usuario');
    expect(rolLabel(undefined)).toBe('Usuario');
    expect(rolLabel(99)).toBe('Usuario');
  });
});

describe('roles — matriz de páginas permitidas', () => {
  it('MANICURISTA: atención (dashboard, citas, clientes, servicios, horarios) sin finanzas/ventas', () => {
    for (const href of ['/', '/agenda', '/clientes', '/servicios', '/horarios']) {
      expect(canAccessPage(Rol.MANICURISTA, href)).toBe(true);
    }
    for (const href of ['/finanzas', '/ventas', '/empleadas', '/productos', '/categorias', '/prestamos']) {
      expect(canAccessPage(Rol.MANICURISTA, href)).toBe(false);
    }
  });

  it('RECEPCIONISTA: front desk (ventas, finanzas) sin nómina ni préstamos ni administración', () => {
    for (const href of ['/', '/agenda', '/clientes', '/ventas', '/finanzas', '/horarios']) {
      expect(canAccessPage(Rol.RECEPCIONISTA, href)).toBe(true);
    }
    for (const href of ['/empleadas', '/productos', '/categorias', '/prestamos', '/servicios']) {
      expect(canAccessPage(Rol.RECEPCIONISTA, href)).toBe(false);
    }
  });

  it('CONTADOR: finanzas y catálogo, sin ventas ni gestión de citas', () => {
    for (const href of ['/', '/finanzas', '/clientes', '/servicios', '/productos', '/categorias']) {
      expect(canAccessPage(Rol.CONTADOR, href)).toBe(true);
    }
    for (const href of ['/ventas', '/agenda', '/empleadas', '/prestamos', '/horarios']) {
      expect(canAccessPage(Rol.CONTADOR, href)).toBe(false);
    }
  });

  it('ADMINISTRADOR, DUEÑA y SUPERADMIN acceden a todas las páginas', () => {
    for (const rol of [Rol.ADMINISTRADOR, Rol.DUEÑA, Rol.SUPERADMIN]) {
      for (const href of ALL_PAGES) {
        expect(canAccessPage(rol, href)).toBe(true);
      }
    }
  });

  it('rol null/undefined no accede a ninguna página', () => {
    expect(canAccessPage(null, '/')).toBe(false);
    expect(canAccessPage(undefined, '/clientes')).toBe(false);
  });
});

describe('roles — resolveRouteGuard (redirección de rutas)', () => {
  it('permite la ruta cuando el rol la tiene en la matriz (null = sin redirección)', () => {
    expect(resolveRouteGuard(Rol.MANICURISTA, '/clientes')).toBeNull();
    expect(resolveRouteGuard(Rol.CONTADOR, '/finanzas')).toBeNull();
    expect(resolveRouteGuard(Rol.RECEPCIONISTA, '/ventas')).toBeNull();
  });

  it('redirige al dashboard cuando el rol NO tiene permiso', () => {
    expect(resolveRouteGuard(Rol.MANICURISTA, '/finanzas')).toBe('/');
    expect(resolveRouteGuard(Rol.MANICURISTA, '/empleadas')).toBe('/');
    expect(resolveRouteGuard(Rol.CONTADOR, '/ventas')).toBe('/');
    expect(resolveRouteGuard(Rol.RECEPCIONISTA, '/prestamos')).toBe('/');
  });

  it('no redirige mientras el usuario aún no cargó (rol null → null)', () => {
    expect(resolveRouteGuard(null, '/finanzas')).toBeNull();
    expect(resolveRouteGuard(undefined, '/')).toBeNull();
  });
});

describe('roles — roles privilegiados (reportes / cuentas)', () => {
  const userConRol = (rol: Rol): IUser => ({ rol } as IUser);

  it('isPrivilegedRole es true para SUPERADMIN, DUEÑA, ADMINISTRADOR y CONTADOR', () => {
    for (const rol of [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR]) {
      expect(isPrivilegedRole(userConRol(rol))).toBe(true);
    }
  });

  it('isPrivilegedRole es false para MANICURISTA, RECEPCIONISTA y usuario ausente', () => {
    expect(isPrivilegedRole(userConRol(Rol.MANICURISTA))).toBe(false);
    expect(isPrivilegedRole(userConRol(Rol.RECEPCIONISTA))).toBe(false);
    expect(isPrivilegedRole(null)).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
  });

  it('PRIVILEGED_ROLES contiene exactamente los 4 roles financieros (espeja el backend)', () => {
    expect(new Set(PRIVILEGED_ROLES)).toEqual(
      new Set([Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR]),
    );
  });
});
