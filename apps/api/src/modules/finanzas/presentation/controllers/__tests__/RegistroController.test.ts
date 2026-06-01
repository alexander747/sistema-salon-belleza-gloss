import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation.
// Path: from __tests__/ up to src/ = 5 levels (controllers, presentation, finanzas, modules, src)
vi.mock('../../../../../infrastructure/persistence/entities/ClienteEntity.js', () => ({
  ClienteEntity: class ClienteEntity {
    id: number;
    totalServicios: number;
    deudaTotal: number;
  },
}));
vi.mock('../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

// Mock database
vi.mock('../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => ({
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        getRepository: vi.fn(() => ({ update: vi.fn() })),
      },
    })),
  },
}));

import type { Request, Response } from 'express';
import { RegistroController } from '../RegistroController';

describe('RegistroController', () => {
  let controller: RegistroController;
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockAnularUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreateUseCase = { execute: vi.fn() };
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockAnularUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new RegistroController(
      mockCreateUseCase as never,
      mockListUseCase as never,
      mockGetUseCase as never,
      mockAnularUseCase as never,
    );
  });

  describe('list', () => {
    it('should return 200 with registros', async () => {
      const expected = [{ id: 1, totalServicios: 100000 }];
      mockListUseCase.execute.mockResolvedValue(expected);

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        desde: undefined,
        hasta: undefined,
        usuarioId: undefined,
        clienteId: undefined,
      });
    });

    it('should pass filter params when provided', async () => {
      mockListUseCase.execute.mockResolvedValue([]);

      const req = {
        salonId: 1,
        query: {
          desde: '2026-05-01',
          hasta: '2026-05-30',
          usuarioId: '3',
          clienteId: '7',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        desde: new Date('2026-05-01'),
        hasta: new Date('2026-05-30'),
        usuarioId: 3,
        clienteId: 7,
      });
    });
  });

  describe('get', () => {
    it('should return 200 with single registro', async () => {
      const expected = { id: 1, totalServicios: 100000 };
      mockGetUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        params: { id: '1' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.get(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('create', () => {
    it('should return 201 with created registro', async () => {
      const expected = { id: 1, totalServicios: 100000, comisionCalculada: 60000 };
      mockCreateUseCase.execute.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        body: {
          clienteId: 1,
          usuarioId: 2,
          totalServicios: 100000,
          totalProductos: 50000,
          propina: 10000,
          pagos: [{ monto: 100000, metodoPago: 'EFECTIVO' }],
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith({
        ...req.body,
        salonId: 1,
      });
    });
  });

  describe('anular', () => {
    it('should return 204 on success', async () => {
      mockAnularUseCase.execute.mockResolvedValue(undefined);

      const req = {
        salonId: 1,
        params: { id: '5' },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as Response;

      await controller.anular(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(mockAnularUseCase.execute).toHaveBeenCalledWith({
        id: 5,
        salonId: 1,
      });
    });
  });
});
