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

vi.mock('../../controllers/RegistroController', () => ({ RegistroController: class { list = stub; create = stub; get = stub; anular = stub; abonar = stub; } }));
vi.mock('../../controllers/GastoController', () => ({ GastoController: class { list = stub; create = stub; delete = stub; } }));
vi.mock('../../controllers/DevolucionController', () => ({ DevolucionController: class { list = stub; create = stub; } }));
vi.mock('../../controllers/LiquidacionController', () => ({ LiquidacionController: class { nominaPendiente = stub; liquidarEmpleada = stub; historial = stub; } }));
vi.mock('../../controllers/ReporteController', () => ({ ReporteController: class { resumenDia = stub; roiMensual = stub; pyl = stub; exportar = stub; cierreTurno = stub; } }));
vi.mock('../../controllers/CajaController', () => ({ CajaController: class { abrir = stub; cerrar = stub; reabrir = stub; actual = stub; actualEsperado = stub; cierres = stub; detalleCierre = stub; } }));
vi.mock('../../controllers/CuentasController', () => ({ CuentasController: class { cobrar = stub; pagar = stub; } }));

import { finanzasRouter } from '../finanzas.routes';

/** Roles exigidos por requireRole en la ruta GET dada (en orden de registro). */
function guardsFor(path: string): Rol[][] {
  const router = finanzasRouter as unknown as {
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

/** Roles exigidos por requireRole en la ruta POST dada. */
function guardsForPost(path: string): Rol[][] {
  const router = finanzasRouter as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } }[];
  };
  const layers = router.stack.filter(
    (l) => l.route && l.route.path === path && l.route.methods.post,
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

const NOMINA_ROLES = [Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR];

describe('finanzas.routes — guards de rol en GETs sensibles', () => {
  beforeEach(() => {
    requireRoleMock.mockClear();
  });

  it('GET /finanzas/nomina exige SUPERADMIN/DUEÑA/ADMINISTRADOR/CONTADOR', () => {
    expect(guardsFor('/finanzas/nomina')).toContainEqual(NOMINA_ROLES);
  });

  it('GET /finanzas/nomina/historial exige SUPERADMIN/DUEÑA/ADMINISTRADOR/CONTADOR', () => {
    expect(guardsFor('/finanzas/nomina/historial')).toContainEqual(NOMINA_ROLES);
  });

  it('GET /caja/:id/cierre permite también a CONTADOR y RECEPCIONISTA (vista read-only)', () => {
    expect(guardsFor('/caja/:id/cierre')).toContainEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
      Rol.CONTADOR,
      Rol.RECEPCIONISTA,
    ]);
  });

  it('POST /registros/:id/pagos (abono) exige SUPERADMIN/DUEÑA/ADMINISTRADOR/RECEPCIONISTA — mismos roles que POST /registros', () => {
    expect(guardsForPost('/registros/:id/pagos')).toContainEqual([
      Rol.SUPERADMIN,
      Rol.DUEÑA,
      Rol.ADMINISTRADOR,
      Rol.RECEPCIONISTA,
    ]);
  });
});
