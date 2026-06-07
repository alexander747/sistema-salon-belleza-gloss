import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ClienteController } from '../ClienteController';

describe('ClienteController', () => {
  let controller: ClienteController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockUpdateUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new ClienteController(
      mockListUseCase as never,
      mockGetUseCase as never,
      mockCreateUseCase as never,
      mockUpdateUseCase as never,
    );
  });

  describe('list', () => {
    it('should return paginated clientes with default page/limit', async () => {
      const expected = {
        data: [{ id: 1, nombre: 'Juan', telefono: '+541112345' }],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
      };
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: {},
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        page: 1,
        limit: 0,
        q: undefined,
      });
    });

    it('should pass q search param', async () => {
      mockListUseCase.execute.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
      });

      const req = {
        salonId: 1,
        query: { q: 'Juan', page: '1', limit: '12' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        page: 1,
        limit: 12,
        q: 'Juan',
      });
    });
  });

  describe('create', () => {
    it('should return 201 for new cliente', async () => {
      const expected = { id: 10, nombre: 'Juan', telefono: '+541112345', activo: true, puntajeConfianza: 100 };
      mockCreateUseCase.execute.mockResolvedValue({ cliente: expected, created: true });

      const req = {
        salonId: 1,
        body: { nombre: 'Juan', telefono: '+541112345' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expected);
    });

    it('should return 200 for duplicate phone (idempotent)', async () => {
      const existingCliente = { id: 10, nombre: 'Juan', telefono: '+541112345', activo: true, puntajeConfianza: 100 };
      mockCreateUseCase.execute.mockResolvedValue({ cliente: existingCliente, created: false });

      const req = {
        salonId: 1,
        body: { nombre: 'Juan', telefono: '+541112345' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(existingCliente);
    });
  });
});
