import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { EmpleadaController } from '../EmpleadaController';
import { Rol } from '@pos-final/types';

describe('EmpleadaController', () => {
  let controller: EmpleadaController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUpdateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockActivateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockDeactivateUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockUpdateUseCase = { execute: vi.fn() };
    mockActivateUseCase = { execute: vi.fn() };
    mockDeactivateUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new EmpleadaController(
      mockListUseCase as never,
      mockGetUseCase as never,
      mockCreateUseCase as never,
      mockUpdateUseCase as never,
      mockActivateUseCase as never,
      mockDeactivateUseCase as never,
    );
  });

  describe('list', () => {
    it('should return 200 with empleadas and pass userRol', async () => {
      const expected = [{ id: 1, nombre: 'Ana', rol: Rol.MANICURISTA }];
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: {},
        user: { rol: Rol.DUEÑA },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        userRol: Rol.DUEÑA,
        rol: undefined,
        activo: undefined,
      });
    });

    it('should pass rol and activo filters when provided', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      const req = {
        salonId: 1,
        query: { rol: '4', activo: 'true' },
        user: { rol: Rol.DUEÑA },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        userRol: Rol.DUEÑA,
        rol: 4,
        activo: true,
      });
    });
  });

  describe('create', () => {
    it('should return 201 with created empleada', async () => {
      const expected = { id: 2, nombre: 'Maria', rol: Rol.MANICURISTA };
      mockCreateUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        body: { nombre: 'Maria', numeroWhatsApp: '+541116789', email: 'maria@test.com', password: 'pass123', rol: Rol.MANICURISTA },
        user: { rol: Rol.DUEÑA },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expected);
    });
  });

  describe('deactivate', () => {
    it('should return 200 with activo: false', async () => {
      mockDeactivateUseCase.execute.mockResolvedValue({ activo: false });

      const req = {
        salonId: 1,
        params: { id: '5' },
        user: { id: 1 },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.deactivate(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ activo: false });
      expect(mockDeactivateUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        id: 5,
        requestingUserId: 1,
      });
    });
  });
});
