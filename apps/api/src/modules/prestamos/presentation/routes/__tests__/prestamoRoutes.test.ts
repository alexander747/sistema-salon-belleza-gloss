import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Rol } from '@pos-final/types';

const { requireRoleMock, stub } = vi.hoisted(() => ({
  requireRoleMock: vi.fn((...roles: Rol[]) => {
    const middleware = () => {};
    (middleware as unknown as { __requireRole: boolean }).__requireRole = true;
    (middleware as unknown as { __roles: Rol[] }).__roles = roles;
    return middleware;
  }),
  stub: () => {},
}));

vi.mock('tsyringe', () => ({
  container: { resolve: (C: new () => unknown) => new C() },
  injectable: () => () => {},
  inject: () => () => {},
}));

vi.mock('../../../../../presentation/middleware/requireRole', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('../../controllers/PrestamoController', () => ({ PrestamoController: class { list = stub; prestamosPorEmpleado = stub; create = stub; get = stub; update = stub; cancelar = stub; registrarPago = stub; } }));

import { prestamoRouter } from '../prestamoRoutes';

/** Roles exigidos por requireRole en la ruta GET dada (en orden de registro). */
function guardsFor(path: string): Rol[][] {
  const router = prestamoRouter as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } }[];
  };
  const layers = router.stack.filter(
    (l) => l.route && l.route.path === path && l.route.methods.get,
  );
  const roles: Rol[][] = [];
  for (const layer of layers) {
    for (const h of layer.route!.stack) {
      const handle = h.handle as unknown as { __requireRole?: boolean; __roles?: Rol[] };
      if (typeof h.handle === 'function' && handle.__requireRole) {
        roles.push(handle.__roles!);
      }
    }
  }
  return roles;
}

const PRESTAMOS_ROLES = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR];

describe('prestamoRoutes — guards de rol en GETs sensibles', () => {
  beforeEach(() => {
    requireRoleMock.mockClear();
  });

  it('GET /prestamos (lista) exige SUPERADMIN/DUEÑA/ADMINISTRADOR', () => {
    expect(guardsFor('/prestamos')).toContainEqual(PRESTAMOS_ROLES);
  });

  it('GET /prestamos/:id exige SUPERADMIN/DUEÑA/ADMINISTRADOR (deuda sensible)', () => {
    expect(guardsFor('/prestamos/:id')).toContainEqual(PRESTAMOS_ROLES);
  });

  it('GET /prestamos/empleado/:usuarioId exige SUPERADMIN/DUEÑA/ADMINISTRADOR', () => {
    expect(guardsFor('/prestamos/empleado/:usuarioId')).toContainEqual(PRESTAMOS_ROLES);
  });
});
