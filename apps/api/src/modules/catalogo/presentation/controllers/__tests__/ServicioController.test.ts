import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ServicioController } from '../ServicioController';

describe('ServicioController', () => {
  let controller: ServicioController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDeleteUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockUpdateUseCase = { execute: vi.fn() };
    mockDeleteUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new ServicioController(
      mockListUseCase as never,
      mockGetUseCase as never,
      mockCreateUseCase as never,
      mockUpdateUseCase as never,
      mockDeleteUseCase as never,
    );
  });

  describe('list', () => {
    it('should return 200 with servicios', async () => {
      const expected = [{ id: 1, nombre: 'Manicure', precioFinal: 1000 }];
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        categoriaId: undefined,
      });
    });

    it('should pass categoriaId filter when provided', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      const req = {
        salonId: 1,
        query: { categoriaId: '3' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        categoriaId: 3,
      });
    });
  });

  describe('get', () => {
    it('should return 200 with single servicio', async () => {
      const expected = { id: 1, nombre: 'Manicure', precioFinal: 1000 };
      mockGetUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '1' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.get(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({ salonId: 1, id: 1 });
    });
  });

  describe('create', () => {
    it('should return 201 with created servicio', async () => {
      const expected = { id: 1, nombre: 'Nuevo Servicio', precioFinal: 1000 };
      mockCreateUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        body: { nombre: 'Nuevo Servicio', precioBase: 1000, categoriaId: 1 },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expected);
    });
  });

  describe('delete', () => {
    it('should return 200 with success status', async () => {
      mockDeleteUseCase.execute.mockResolvedValue({ success: true });

      const req = {
        salonId: 1,
        params: { id: '1' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.delete(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
