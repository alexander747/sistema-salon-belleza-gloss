import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ReporteController } from '../ReporteController';

describe('ReporteController', () => {
  let controller: ReporteController;
  let mockResumenDiaUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockROIMensualUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCierreTurnoUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockResumenDiaUseCase = { execute: vi.fn() };
    mockROIMensualUseCase = { execute: vi.fn() };
    mockCierreTurnoUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new ReporteController(
      mockResumenDiaUseCase as never,
      mockROIMensualUseCase as never,
      mockCierreTurnoUseCase as never,
    );
  });

  describe('resumenDia', () => {
    it('should return 200 with daily summary', async () => {
      const expected = {
        totalServicios: 300000,
        totalProductos: 100000,
        totalPropinas: 50000,
        totalComisiones: 180000,
        cantidadAtenciones: 3,
        totalIngresos: 400000,
      };
      mockResumenDiaUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: { fecha: '2026-05-30' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.resumenDia(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockResumenDiaUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        fecha: new Date('2026-05-30'),
      });
    });

    it('should use current date when no fecha query param', async () => {
      mockResumenDiaUseCase.execute.mockResolvedValue({
        totalServicios: 0,
        totalProductos: 0,
        totalPropinas: 0,
        totalComisiones: 0,
        cantidadAtenciones: 0,
        totalIngresos: 0,
      });

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.resumenDia(req, res, next);

      const today = new Date();
      expect(mockResumenDiaUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        fecha: expect.any(Date),
      });
      // Verify it's today
      const calledArg = mockResumenDiaUseCase.execute.mock.calls[0][0];
      expect(calledArg.fecha.getDate()).toBe(today.getDate());
    });
  });

  describe('roiMensual', () => {
    it('should return 200 with monthly ROI', async () => {
      const expected = {
        ingresos: 500000,
        gastosFijos: 100000,
        gastosOperativos: 50000,
        nomina: 200000,
        gananciaNeta: 150000,
      };
      mockROIMensualUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: { mes: '2026-05' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.roiMensual(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockROIMensualUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        mes: new Date('2026-05-01'),
      });
    });

    it('should use current month when no mes query param', async () => {
      mockROIMensualUseCase.execute.mockResolvedValue({
        ingresos: 0,
        gastosFijos: 0,
        gastosOperativos: 0,
        nomina: 0,
        gananciaNeta: 0,
      });

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.roiMensual(req, res, next);

      const today = new Date();
      expect(mockROIMensualUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        mes: expect.any(Date),
      });
      const calledArg = mockROIMensualUseCase.execute.mock.calls[0][0];
      expect(calledArg.mes.getMonth()).toBe(today.getMonth());
    });
  });

  describe('cierreTurno', () => {
    it('should return 200 with employee shift summary', async () => {
      const expected = {
        serviciosRealizados: 5,
        productosVendidos: 50000,
        comisionGanada: 60000,
        propinasRecibidas: 20000,
        totalACobrar: 80000,
        totalAEntregar: 240000,
      };
      mockCierreTurnoUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '3' },
        query: { fecha: '2026-05-30' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cierreTurno(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockCierreTurnoUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        usuarioId: 3,
        fecha: new Date('2026-05-30'),
      });
    });

    it('should use current date when no fecha query param', async () => {
      mockCierreTurnoUseCase.execute.mockResolvedValue({
        serviciosRealizados: 0,
        productosVendidos: 0,
        comisionGanada: 0,
        propinasRecibidas: 0,
        totalACobrar: 0,
        totalAEntregar: 0,
      });

      const req = {
        salonId: 1,
        params: { id: '3' },
        query: {},
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cierreTurno(req, res, next);

      expect(mockCierreTurnoUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        usuarioId: 3,
        fecha: expect.any(Date),
      });
    });
  });
});
