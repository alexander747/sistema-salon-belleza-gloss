import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Rol } from '@pos-final/types';

/**
 * Integración real de los guards de rol de Reportes: usa el middleware
 * `requireRole` REAL (sin mock) para probar que `/finanzas/pyl` y
 * `/finanzas/exportar` responden 403 a roles no privilegiados y 200 a los
 * privilegiados. `/finanzas/resumen` debe seguir accesible para Registros.
 */

const { respond200 } = vi.hoisted(() => ({
  respond200: (
    _req: unknown,
    res: { status: (code: number) => { json: (body: unknown) => void } },
  ) => res.status(200).json({ ok: true }),
}));

vi.mock('tsyringe', () => ({
  container: { resolve: (C: new () => unknown) => new C() },
  injectable: () => () => {},
  inject: () => () => {},
}));

vi.mock('../../../../../shared/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../controllers/RegistroController', () => ({
  RegistroController: class { list = () => {}; create = () => {}; get = () => {}; anular = () => {}; abonar = () => {}; },
}));
vi.mock('../../controllers/GastoController', () => ({
  GastoController: class { list = () => {}; create = () => {}; delete = () => {}; },
}));
vi.mock('../../controllers/DevolucionController', () => ({
  DevolucionController: class { list = () => {}; create = () => {}; },
}));
vi.mock('../../controllers/LiquidacionController', () => ({
  LiquidacionController: class { nominaPendiente = () => {}; liquidarEmpleada = () => {}; historial = () => {}; },
}));
vi.mock('../../controllers/ReporteController', () => ({
  ReporteController: class {
    resumenDia = respond200;
    roiMensual = () => {};
    pyl = respond200;
    exportar = respond200;
    cierreTurno = () => {};
    resumenMensual = () => {};
  },
}));
vi.mock('../../controllers/CajaController', () => ({
  CajaController: class { abrir = () => {}; cerrar = () => {}; reabrir = () => {}; actual = () => {}; actualEsperado = () => {}; cierres = () => {}; detalleCierre = () => {}; },
}));
vi.mock('../../controllers/CuentasController', () => ({
  CuentasController: class { cobrar = () => {}; pagar = () => {}; },
}));

import { finanzasRouter } from '../finanzas.routes';
import { errorHandler } from '../../../../../presentation/middleware/errorHandler';

function buildApp(rol: Rol): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = {
      id: 7,
      email: 'u@t.com',
      rol,
      salonId: 1,
      nombre: 'Usuario',
    };
    (req as unknown as { salonId: number }).salonId = 1;
    next();
  });
  app.use('/salones/:salonId', finanzasRouter);
  app.use(errorHandler);
  return app;
}

describe('finanzas routes — gating real de Reportes', () => {
  it('GET /finanzas/pyl responde 403 INSUFFICIENT_ROLE a un rol no privilegiado', async () => {
    const res = await request(buildApp(Rol.MANICURISTA)).get('/salones/1/finanzas/pyl');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('GET /finanzas/pyl responde 200 a un rol privilegiado', async () => {
    const res = await request(buildApp(Rol.DUEÑA)).get('/salones/1/finanzas/pyl');
    expect(res.status).toBe(200);
  });

  it('GET /finanzas/exportar responde 403 INSUFFICIENT_ROLE a un rol no privilegiado', async () => {
    const res = await request(buildApp(Rol.RECEPCIONISTA)).get('/salones/1/finanzas/exportar');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('GET /finanzas/exportar responde 200 a un rol privilegiado', async () => {
    const res = await request(buildApp(Rol.CONTADOR)).get('/salones/1/finanzas/exportar');
    expect(res.status).toBe(200);
  });

  it('GET /finanzas/resumen sigue accesible (200) para un rol no privilegiado', async () => {
    const res = await request(buildApp(Rol.MANICURISTA)).get('/salones/1/finanzas/resumen');
    expect(res.status).toBe(200);
  });
});
