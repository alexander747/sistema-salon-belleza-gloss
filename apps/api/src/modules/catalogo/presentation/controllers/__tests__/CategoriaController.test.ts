import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { CategoriaController } from '../CategoriaController';

describe('CategoriaController', () => {
  let controller: CategoriaController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDeleteUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockUpdateUseCase = { execute: vi.fn() };
    mockDeleteUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new CategoriaController(
      mockListUseCase as never,
      mockCreateUseCase as never,
      mockUpdateUseCase as never,
      mockDeleteUseCase as never,
    );
  });

  describe('list', () => {
    it('should return 200 with categorias', async () => {
      const expected = [{ id: 1, nombre: 'Uñas', activo: true }];
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1 } as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({ salonId: 1 });
    });
  });

  describe('create', () => {
    it('should return 201 with created categoria', async () => {
      const expected = { id: 1, nombre: 'Nueva Cat', activo: true };
      mockCreateUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1, body: { nombre: 'Nueva Cat' } } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        nombre: 'Nueva Cat',
      });
    });
  });

  describe('update', () => {
    it('should return 200 with updated categoria', async () => {
      const expected = { id: 1, nombre: 'Updated', activo: true };
      mockUpdateUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '1' },
        body: { nombre: 'Updated' },
      } as unknown as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.update(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 1,
        nombre: 'Updated',
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
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.delete(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 1,
      });
    });
  });
});
