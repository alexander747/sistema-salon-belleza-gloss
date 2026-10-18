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
  GastoController: class { list = respond200; create = () => {}; delete = () => {}; },
}));
vi.mock('../../controllers/DevolucionController', () => ({
  DevolucionController: class { list = respond200; create = () => {}; },
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
  CajaController: class {
    abrir = () => {};
    cerrar = () => {};
    reabrir = () => {};
    actual = () => {};
    actualEsperado = () => {};
    cierres = () => {};
    detalleCierre = () => {};
    saldoInicial = respond200;
    actualizarSaldoInicial = respond200;
  },
}));
vi.mock('../../controllers/CuentasController', () => ({
  CuentasController: class { cobrar = () => {}; pagar = () => {}; },
}));

import { finanzasRouter } from '../finanzas.routes';
import { errorHandler } from '../../../../../presentation/middleware/errorHandler';

function buildApp(rol: Rol): express.Express {
  const app = express();
  // La validación de body (validate) necesita el parser para los PUT.
  app.use(express.json());
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

describe('finanzas routes — gating real del Saldo inicial de caja', () => {
  it('GET /caja/saldo-inicial responde 403 a un rol no autorizado (MANICURISTA)', async () => {
    const res = await request(buildApp(Rol.MANICURISTA)).get('/salones/1/caja/saldo-inicial');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('GET /caja/saldo-inicial responde 200 a DUEÑA y a ADMINISTRADOR', async () => {
    expect((await request(buildApp(Rol.DUEÑA)).get('/salones/1/caja/saldo-inicial')).status).toBe(200);
    expect((await request(buildApp(Rol.ADMINISTRADOR)).get('/salones/1/caja/saldo-inicial')).status).toBe(200);
  });

  it('PUT /caja/saldo-inicial responde 403 a ADMINISTRADOR (solo DUEÑA/SUPERADMIN editan)', async () => {
    const res = await request(buildApp(Rol.ADMINISTRADOR))
      .put('/salones/1/caja/saldo-inicial')
      .send({ saldoInicialCaja: 100000 });
    expect(res.status).toBe(403);
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('PUT /caja/saldo-inicial responde 403 a RECEPCIONISTA', async () => {
    const res = await request(buildApp(Rol.RECEPCIONISTA))
      .put('/salones/1/caja/saldo-inicial')
      .send({ saldoInicialCaja: 100000 });
    expect(res.status).toBe(403);
  });

  it('PUT /caja/saldo-inicial responde 200 a DUEÑA y SUPERADMIN con body válido', async () => {
    expect(
      (
        await request(buildApp(Rol.DUEÑA))
          .put('/salones/1/caja/saldo-inicial')
          .send({ saldoInicialCaja: 100000 })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(buildApp(Rol.SUPERADMIN))
          .put('/salones/1/caja/saldo-inicial')
          .send({ saldoInicialCaja: 0 })
      ).status,
    ).toBe(200);
  });

  it('PUT /caja/saldo-inicial responde 400 con body inválido (saldo negativo)', async () => {
    const res = await request(buildApp(Rol.DUEÑA))
      .put('/salones/1/caja/saldo-inicial')
      .send({ saldoInicialCaja: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('finanzas routes — gating real de Gastos y Devoluciones', () => {
  it('GET /gastos responde 403 INSUFFICIENT_ROLE a RECEPCIONISTA', async () => {
    const res = await request(buildApp(Rol.RECEPCIONISTA)).get('/salones/1/gastos');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('GET /gastos responde 403 a MANICURISTA', async () => {
    const res = await request(buildApp(Rol.MANICURISTA)).get('/salones/1/gastos');
    expect(res.status).toBe(403);
  });

  it('GET /gastos responde 200 a CONTADOR', async () => {
    const res = await request(buildApp(Rol.CONTADOR)).get('/salones/1/gastos');
    expect(res.status).toBe(200);
  });

  it('GET /devoluciones responde 403 INSUFFICIENT_ROLE a RECEPCIONISTA', async () => {
    const res = await request(buildApp(Rol.RECEPCIONISTA)).get('/salones/1/devoluciones');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.details.code).toBe('INSUFFICIENT_ROLE');
  });

  it('GET /devoluciones responde 200 a DUEÑA', async () => {
    const res = await request(buildApp(Rol.DUEÑA)).get('/salones/1/devoluciones');
    expect(res.status).toBe(200);
  });
});
