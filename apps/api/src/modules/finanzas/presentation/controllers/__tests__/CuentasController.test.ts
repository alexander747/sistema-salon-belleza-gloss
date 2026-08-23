import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Rol } from '@pos-final/types';
import { CuentasController } from '../CuentasController';
import { requireRole } from '../../../../../presentation/middleware/requireRole';
import { ValidationError, ForbiddenError } from '../../../../../shared/errors';

describe('CuentasController', () => {
  let controller: CuentasController;
  let mockCobrarUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockPagarUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCobrarUseCase = { execute: vi.fn() };
    mockPagarUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new CuentasController(mockCobrarUseCase as never, mockPagarUseCase as never);
  });

  describe('cobrar', () => {
    it('devuelve 200 con { ok: true, data } y pasa page/limit parseados (DTO con registros[] del use case)', async () => {
      const expected = {
        data: [
          {
            id: 1,
            tipo: 'CLIENTE',
            nombre: 'Ana',
            deudaTotal: 40000,
            cantidadRegistros: 2,
            registros: [
              { registroId: 2, fechaHora: new Date('2026-07-01T10:00:00-05:00'), montoPendiente: 25000 },
              { registroId: 1, fechaHora: new Date('2026-08-10T10:00:00-05:00'), montoPendiente: 15000 },
            ],
          },
        ],
        meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
      };
      mockCobrarUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1, query: { page: '2', limit: '10' } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cobrar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: expected });
      expect(mockCobrarUseCase.execute).toHaveBeenCalledWith({ salonId: 1, page: 2, limit: 10 });
    });

    it('usa page=1 y limit=0 cuando no vienen parámetros', async () => {
      mockCobrarUseCase.execute.mockResolvedValue({ data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } });

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cobrar(req, res, next);

      expect(mockCobrarUseCase.execute).toHaveBeenCalledWith({ salonId: 1, page: 1, limit: 0 });
    });

    it('paginación inválida → next(ValidationError) sin llamar al use case', async () => {
      const req = { salonId: 1, query: { page: 'abc' } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cobrar(req, res, next);

      expect(mockCobrarUseCase.execute).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('pagar', () => {
    it('devuelve 200 con { ok: true, data } y pasa page/limit parseados', async () => {
      const expected = { data: [{ empleadaId: 1 }], meta: { page: 1, limit: 5, total: 1, totalPages: 1 } };
      mockPagarUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1, query: { page: '1', limit: '5' } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.pagar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: expected });
      expect(mockPagarUseCase.execute).toHaveBeenCalledWith({ salonId: 1, page: 1, limit: 5 });
    });

    it('paginación inválida → next(ValidationError) sin llamar al use case', async () => {
      const req = { salonId: 1, query: { limit: '500' } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.pagar(req, res, next);

      expect(mockPagarUseCase.execute).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
    });
  });

  describe('requireRole en rutas (SUPERADMIN, DUEÑA, ADMINISTRADOR, CONTADOR)', () => {
    const cuentasRoleGuard = requireRole(Rol.SUPERADMIN, Rol.DUEÑA, Rol.ADMINISTRADOR, Rol.CONTADOR);

    it('permite CONTADOR (next sin error)', () => {
      const req = { user: { id: 1, email: 'c@test.com', rol: Rol.CONTADOR, salonId: 1, nombre: 'C' } } as Request;
      const nextFn = vi.fn();

      cuentasRoleGuard(req, {} as Response, nextFn);

      expect(nextFn).toHaveBeenCalledTimes(1);
      expect(nextFn.mock.calls[0][0]).toBeUndefined();
    });

    it('bloquea RECEPCIONISTA con 403 (ForbiddenError)', () => {
      const req = { user: { id: 2, email: 'r@test.com', rol: Rol.RECEPCIONISTA, salonId: 1, nombre: 'R' } } as Request;
      const nextFn = vi.fn();

      let error: unknown;
      try {
        cuentasRoleGuard(req, {} as Response, nextFn);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('bloquea MANICURISTA con 403 (ForbiddenError)', () => {
      const req = { user: { id: 3, email: 'm@test.com', rol: Rol.MANICURISTA, salonId: 1, nombre: 'M' } } as Request;
      const nextFn = vi.fn();

      let error: unknown;
      try {
        cuentasRoleGuard(req, {} as Response, nextFn);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
      expect(nextFn).not.toHaveBeenCalled();
    });
  });
});
