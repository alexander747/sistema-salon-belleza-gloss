import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ProductoController } from '../ProductoController';
import { Rol } from '@pos-final/types';

describe('ProductoController', () => {
  let controller: ProductoController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDescontarUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockReabastecerUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockRestockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockHistorialUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDeleteUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockUpdateUseCase = { execute: vi.fn() };
    mockDescontarUseCase = { execute: vi.fn() };
    mockReabastecerUseCase = { execute: vi.fn() };
    mockRestockUseCase = { execute: vi.fn() };
    mockHistorialUseCase = { execute: vi.fn() };
    mockDeleteUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new ProductoController(
      mockListUseCase as never,
      mockGetUseCase as never,
      mockCreateUseCase as never,
      mockUpdateUseCase as never,
      mockDescontarUseCase as never,
      mockReabastecerUseCase as never,
      mockDeleteUseCase as never,
      mockRestockUseCase as never,
      mockHistorialUseCase as never,
    );
  });

  describe('list', () => {
    it('should return 200 with productos and pass userRol', async () => {
      const expected = [{ id: 1, nombre: 'Esmalte', precioVenta: 150 }];
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: {},
        user: { rol: Rol.MANICURISTA },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        tipoInventario: undefined,
        userRol: Rol.MANICURISTA,
        page: 1,
        limit: 0,
        q: undefined,
      });
    });

    it('should pass tipo filter when provided', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      const req = {
        salonId: 1,
        query: { tipo: 'INTERNAL' },
        user: { rol: Rol.DUEÑA },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        tipoInventario: 'INTERNAL',
        userRol: Rol.DUEÑA,
        page: 1,
        limit: 0,
        q: undefined,
      });
    });

    it('should work without user (n8n context)', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      const req = {
        salonId: 1,
        query: {},
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        tipoInventario: undefined,
        userRol: undefined,
        page: 1,
        limit: 0,
        q: undefined,
      });
    });
  });

  describe('get', () => {
    it('should return 200 with single producto', async () => {
      const expected = { id: 1, nombre: 'Esmalte', precioVenta: 150 };
      mockGetUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '5' },
        user: { rol: Rol.CONTADOR },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.get(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 5,
        userRol: Rol.CONTADOR,
      });
    });
  });

  describe('create', () => {
    it('should return 201 with created producto', async () => {
      const expected = { id: 1, nombre: 'Esmalte Rojo', cantidadStock: 0, activo: true };
      mockCreateUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        body: { nombre: 'Esmalte Rojo', precioVenta: 150, tipoInventario: 'RETAIL' },
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

  describe('descontar', () => {
    it('should return 200 after decrementing stock', async () => {
      const expected = { id: 1, nombre: 'Esmalte', cantidadStock: 7 };
      mockDescontarUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '1' },
        body: { cantidad: 3 },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.descontar(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockDescontarUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 1,
        cantidad: 3,
      });
    });
  });

  describe('reabastecer', () => {
    it('should return 200 after incrementing stock', async () => {
      const expected = { id: 1, nombre: 'Esmalte', cantidadStock: 15 };
      mockReabastecerUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '1' },
        body: { cantidad: 5, precioCompra: 60 },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.reabastecer(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockReabastecerUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 1,
        cantidad: 5,
        precioCompra: 60,
      });
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
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 1,
      });
    });
  });
});
