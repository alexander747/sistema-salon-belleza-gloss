import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Rol } from '@pos-final/types';

/* ── Mocks: evitamos DI real y registramos los roles que exige requireRole ── */

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

vi.mock('../../controllers/CategoriaController', () => ({
  CategoriaController: class { list = stub; create = stub; update = stub; delete = stub; },
}));
vi.mock('../../controllers/ServicioController', () => ({
  ServicioController: class { list = stub; get = stub; create = stub; update = stub; delete = stub; },
}));
vi.mock('../../controllers/ProductoController', () => ({
  ProductoController: class {
    list = stub; get = stub; create = stub; update = stub; descontar = stub;
    reabastecer = stub; restock = stub; historialPrecios = stub; delete = stub; exportar = stub;
  },
}));

import { catalogoRouter } from '../catalogo.routes';

/** Índice de la capa de una ruta GET/POST dentro del stack del router. */
function layerIndex(path: string, method: 'get' | 'post' | 'delete'): number {
  const router = catalogoRouter as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean> } }[];
  };
  return router.stack.findIndex(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
}

/** Roles exigidos por requireRole en la ruta GET dada (en orden de registro). */
function guardsFor(path: string): Rol[][] {
  const router = catalogoRouter as unknown as {
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

const PRIVILEGED = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR];

describe('catalogo.routes — exportar productos', () => {
  beforeEach(() => {
    requireRoleMock.mockClear();
  });

  it('GET /productos/exportar se registra ANTES de /productos/:id (no es un :id)', () => {
    const exportarIdx = layerIndex('/productos/exportar', 'get');
    const detalleIdx = layerIndex('/productos/:id', 'get');
    expect(exportarIdx).toBeGreaterThanOrEqual(0);
    expect(detalleIdx).toBeGreaterThanOrEqual(0);
    expect(exportarIdx).toBeLessThan(detalleIdx);
  });

  it('GET /productos/exportar exige SUPERADMIN/DUEÑA/ADMINISTRADOR/CONTADOR', () => {
    expect(guardsFor('/productos/exportar')).toContainEqual(PRIVILEGED);
  });
});
