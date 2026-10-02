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

type Method = 'get' | 'post' | 'put' | 'delete';

/** Índice de la capa de una ruta (método + path) dentro del stack del router. */
function layerIndex(path: string, method: Method): number {
  const router = catalogoRouter as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean> } }[];
  };
  return router.stack.findIndex(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
}

/** Roles exigidos por requireRole en la ruta (método + path) dada. */
function guardsFor(method: Method, path: string): Rol[][] {
  const router = catalogoRouter as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } }[];
  };
  const layers = router.stack.filter(
    (l) => l.route && l.route.path === path && l.route.methods[method],
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

describe('catalogo.routes — lecturas de Productos y Categorías sin guard', () => {
  it('GET /productos y GET /productos/:id no exigen rol', () => {
    expect(guardsFor('get', '/productos')).toHaveLength(0);
    expect(guardsFor('get', '/productos/:id')).toHaveLength(0);
  });

  it('GET /categorias no exige rol', () => {
    expect(guardsFor('get', '/categorias')).toHaveLength(0);
  });

  it('control positivo: las escrituras y el historial de precios SÍ exigen rol', () => {
    // Prueba que la detección de requireRole funciona (los "0 guards" no son triviales)
    expect(guardsFor('post', '/productos')).toContainEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
    ]);
    expect(guardsFor('post', '/categorias')).toContainEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
    ]);
    expect(guardsFor('get', '/productos/:id/historial-precios')).toContainEqual(PRIVILEGED);
  });
});

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
    expect(guardsFor('get', '/productos/exportar')).toContainEqual(PRIVILEGED);
  });
});
