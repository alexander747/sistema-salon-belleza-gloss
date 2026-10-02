import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Rol } from '@pos-final/types';

/**
 * Productos y Categorías exponen lecturas SIN guard de rol: Ventas, Agenda y
 * Registros dependen de `GET /productos` y `GET /categorias`. Este test fija esa
 * invariante a nivel de stack de rutas (no requiere montar la app) y usa rutas
 * hermanas sí guardadas como control positivo para probar que la detección de
 * `requireRole` no es trivial.
 */

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
    reabastecer = stub; restock = stub; historialPrecios = stub; delete = stub;
  },
}));

import { catalogoRouter } from '../catalogo.routes';

type Method = 'get' | 'post' | 'put' | 'delete';

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
    expect(guardsFor('get', '/productos/:id/historial-precios')).toContainEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
      Rol.CONTADOR,
    ]);
  });
});
