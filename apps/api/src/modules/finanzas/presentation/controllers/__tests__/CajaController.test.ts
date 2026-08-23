import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { CajaController } from '../CajaController';
import { CajaNoAbiertaError, CajaYaAbiertaError, NotFoundError } from '../../../../../shared/errors';

describe('CajaController', () => {
  let controller: CajaController;
  let mockAbrir: { execute: ReturnType<typeof vi.fn> };
  let mockCerrar: { execute: ReturnType<typeof vi.fn> };
  let mockReabrir: { execute: ReturnType<typeof vi.fn> };
  let mockActual: { execute: ReturnType<typeof vi.fn> };
  let mockEsperado: { execute: ReturnType<typeof vi.fn> };
  let mockCierres: { execute: ReturnType<typeof vi.fn> };
  let mockDetalle: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  const makeRes = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    return res;
  };

  beforeEach(() => {
    mockAbrir = { execute: vi.fn() };
    mockCerrar = { execute: vi.fn() };
    mockReabrir = { execute: vi.fn() };
    mockActual = { execute: vi.fn() };
    mockEsperado = { execute: vi.fn() };
    mockCierres = { execute: vi.fn() };
    mockDetalle = { execute: vi.fn() };
    next = vi.fn();
    controller = new CajaController(
      mockAbrir as never,
      mockCerrar as never,
      mockReabrir as never,
      mockActual as never,
      mockEsperado as never,
      mockCierres as never,
      mockDetalle as never,
    );
  });

  describe('abrir', () => {
    it('should return 201 with envelope {ok:true, data} y auditor req.user?.id', async () => {
      mockAbrir.execute.mockResolvedValue({ id: 7, salonId: 3, estado: 'ABIERTA' });

      const req = { salonId: 3, user: { id: 9 }, body: { montoInicial: 50000 } } as unknown as Request;
      const res = makeRes();

      await controller.abrir(req, res, next);

      expect(mockAbrir.execute).toHaveBeenCalledWith({ salonId: 3, montoInicial: 50000, aperturaPorId: 9 });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 7, salonId: 3, estado: 'ABIERTA' } });
    });

    it('should pasar aperturaPorId null cuando no hay req.user (n8n)', async () => {
      mockAbrir.execute.mockResolvedValue({ id: 7 });

      const req = { salonId: 3, body: { montoInicial: 10000 } } as unknown as Request;
      const res = makeRes();

      await controller.abrir(req, res, next);

      expect(mockAbrir.execute).toHaveBeenCalledWith({ salonId: 3, montoInicial: 10000, aperturaPorId: null });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should pasar fechaCaja del body al use case (backfill)', async () => {
      mockAbrir.execute.mockResolvedValue({ id: 7, salonId: 3, estado: 'ABIERTA' });

      const req = {
        salonId: 3,
        user: { id: 9 },
        body: { montoInicial: 50000, fechaCaja: '2026-08-16' },
      } as unknown as Request;
      const res = makeRes();

      await controller.abrir(req, res, next);

      expect(mockAbrir.execute).toHaveBeenCalledWith({
        salonId: 3,
        montoInicial: 50000,
        aperturaPorId: 9,
        fechaCaja: '2026-08-16',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should NO incluir fechaCaja cuando no viene en el body (default hoy en el use case)', async () => {
      mockAbrir.execute.mockResolvedValue({ id: 7 });

      const req = { salonId: 3, body: { montoInicial: 10000 } } as unknown as Request;
      const res = makeRes();

      await controller.abrir(req, res, next);

      expect(mockAbrir.execute).toHaveBeenCalledWith(
        expect.not.objectContaining({ fechaCaja: expect.anything() }),
      );
    });
  });

  describe('cerrar', () => {
    it('should return 200 con envelope {ok:true, data} y cierrePorId del usuario', async () => {
      mockCerrar.execute.mockResolvedValue({
        caja: { id: 5, estado: 'CERRADA' },
        reporte: { montoEsperado: 160000, diferencia: 0 },
      });

      const req = { salonId: 3, user: { id: 9 }, body: { montoRealEfectivo: 160000 } } as unknown as Request;
      const res = makeRes();

      await controller.cerrar(req, res, next);

      expect(mockCerrar.execute).toHaveBeenCalledWith({ salonId: 3, montoRealEfectivo: 160000, cierrePorId: 9 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data: { caja: { id: 5, estado: 'CERRADA' }, reporte: { montoEsperado: 160000, diferencia: 0 } },
      });
    });

    it('should pasar cierrePorId null en n8n', async () => {
      mockCerrar.execute.mockResolvedValue({ caja: { id: 5 }, reporte: {} });

      const req = { salonId: 3, body: { montoRealEfectivo: 160000 } } as unknown as Request;
      const res = makeRes();

      await controller.cerrar(req, res, next);

      expect(mockCerrar.execute).toHaveBeenCalledWith({ salonId: 3, montoRealEfectivo: 160000, cierrePorId: null });
    });

    it('should pasar cajaId numérico del body al use case (cerrar huérfana por id)', async () => {
      mockCerrar.execute.mockResolvedValue({ caja: { id: 9 }, reporte: {} });

      const req = {
        salonId: 3,
        user: { id: 9 },
        body: { montoRealEfectivo: 175000, cajaId: 9 },
      } as unknown as Request;
      const res = makeRes();

      await controller.cerrar(req, res, next);

      expect(mockCerrar.execute).toHaveBeenCalledWith({
        salonId: 3,
        montoRealEfectivo: 175000,
        cierrePorId: 9,
        cajaId: 9,
      });
    });

    it('should usar cajaId del query como fallback cuando el body no lo trae', async () => {
      mockCerrar.execute.mockResolvedValue({ caja: { id: 9 }, reporte: {} });

      const req = {
        salonId: 3,
        body: { montoRealEfectivo: 175000 },
        query: { cajaId: '9' },
      } as unknown as Request;
      const res = makeRes();

      await controller.cerrar(req, res, next);

      expect(mockCerrar.execute).toHaveBeenCalledWith({
        salonId: 3,
        montoRealEfectivo: 175000,
        cierrePorId: null,
        cajaId: 9,
      });
    });

    it('should NO incluir cajaId cuando no viene en body ni query (fallback a hoy)', async () => {
      mockCerrar.execute.mockResolvedValue({ caja: { id: 5 }, reporte: {} });

      const req = { salonId: 3, body: { montoRealEfectivo: 160000 }, query: {} } as unknown as Request;
      const res = makeRes();

      await controller.cerrar(req, res, next);

      expect(mockCerrar.execute).toHaveBeenCalledWith(
        expect.not.objectContaining({ cajaId: expect.anything() }),
      );
    });
  });

  describe('reabrir', () => {
    it('should return 200 con envelope {ok:true, data} con la caja reabierta ABIERTA', async () => {
      mockReabrir.execute.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });

      const req = { salonId: 3 } as unknown as Request;
      const res = makeRes();

      await controller.reabrir(req, res, next);

      expect(mockReabrir.execute).toHaveBeenCalledWith({ salonId: 3 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 5, salonId: 3, estado: 'ABIERTA' } });
    });

    it('should pasar a next el error cuando la caja ya está ABIERTA (409)', async () => {
      const err = new CajaYaAbiertaError();
      mockReabrir.execute.mockRejectedValue(err);

      const req = { salonId: 3 } as unknown as Request;
      const res = makeRes();

      await controller.reabrir(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('actual', () => {
    it('should return 200 con la caja abierta', async () => {
      mockActual.execute.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });

      const req = { salonId: 3 } as unknown as Request;
      const res = makeRes();

      await controller.actual(req, res, next);

      expect(mockActual.execute).toHaveBeenCalledWith({ salonId: 3 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 5, salonId: 3, estado: 'ABIERTA' } });
    });

    it('should pasar a next el error cuando no hay caja abierta', async () => {
      const err = new CajaNoAbiertaError();
      mockActual.execute.mockRejectedValue(err);

      const req = { salonId: 3 } as unknown as Request;
      const res = makeRes();

      await controller.actual(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('actualEsperado', () => {
    it('should return 200 con el preview del arqueo', async () => {
      mockEsperado.execute.mockResolvedValue({ montoEsperado: 100000, diferencia: null });

      const req = { salonId: 3 } as unknown as Request;
      const res = makeRes();

      await controller.actualEsperado(req, res, next);

      expect(mockEsperado.execute).toHaveBeenCalledWith({ salonId: 3 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { montoEsperado: 100000, diferencia: null } });
    });
  });

  describe('cierres', () => {
    it('should return 200 con {ok:true, data:{data, meta}} pasando page/limit/estado', async () => {
      mockCierres.execute.mockResolvedValue({
        data: [{ id: 1, fechaCaja: '2026-08-15' }],
        meta: { page: 1, limit: 2, total: 5, totalPages: 3 },
      });

      const req = { salonId: 3, query: { page: '1', limit: '2', estado: 'CERRADA' } } as unknown as Request;
      const res = makeRes();

      await controller.cierres(req, res, next);

      expect(mockCierres.execute).toHaveBeenCalledWith({ salonId: 3, page: 1, limit: 2, estado: 'CERRADA' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data: { data: [{ id: 1, fechaCaja: '2026-08-15' }], meta: { page: 1, limit: 2, total: 5, totalPages: 3 } },
      });
    });

    it('should usar defaults page=1 limit=0 y sin estado cuando no vienen en query', async () => {
      mockCierres.execute.mockResolvedValue({ data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } });

      const req = { salonId: 3, query: {} } as unknown as Request;
      const res = makeRes();

      await controller.cierres(req, res, next);

      expect(mockCierres.execute).toHaveBeenCalledWith({ salonId: 3, page: 1, limit: 0, estado: undefined });
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data: { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } },
      });
    });
  });

  describe('detalleCierre', () => {
    it('should return 200 con {ok:true, data} pasando salonId y cajaId del :id', async () => {
      mockDetalle.execute.mockResolvedValue({
        caja: { id: 5, estado: 'CERRADA' },
        reporte: { montoEsperado: 135000 },
        movimientos: [{ id: 1, tipo: 'SERVICIO' }],
      });

      const req = { salonId: 3, params: { id: '5' } } as unknown as Request;
      const res = makeRes();

      await controller.detalleCierre(req, res, next);

      expect(mockDetalle.execute).toHaveBeenCalledWith({ salonId: 3, cajaId: 5 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        data: {
          caja: { id: 5, estado: 'CERRADA' },
          reporte: { montoEsperado: 135000 },
          movimientos: [{ id: 1, tipo: 'SERVICIO' }],
        },
      });
    });

    it('should pasar a next el error cuando la caja no existe (404)', async () => {
      const err = new NotFoundError('Caja no encontrada');
      mockDetalle.execute.mockRejectedValue(err);

      const req = { salonId: 3, params: { id: '999' } } as unknown as Request;
      const res = makeRes();

      await controller.detalleCierre(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
