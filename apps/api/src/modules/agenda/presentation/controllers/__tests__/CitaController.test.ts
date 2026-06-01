import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { CitaController } from '../CitaController';

describe('CitaController', () => {
  let controller: CitaController;
  let mockListUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCreateUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCambiarEstadoUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCancelUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockCompletarUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  const mockCita = {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: '2026-06-01T10:00:00.000Z',
    estado: 'PENDIENTE',
    notas: null,
    esWalkIn: false,
    servicios: [{ id: 1, nombre: 'Manicure', duracionMinutos: 60, precioBase: 1000 }],
    duracionTotalMinutos: 60,
    creadoEn: '2026-06-01T00:00:00.000Z',
    actualizadoEn: '2026-06-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockListUseCase = { execute: vi.fn() };
    mockGetUseCase = { execute: vi.fn() };
    mockCreateUseCase = { execute: vi.fn() };
    mockCambiarEstadoUseCase = { execute: vi.fn() };
    mockCancelUseCase = { execute: vi.fn() };
    mockCompletarUseCase = { execute: vi.fn() };
    next = vi.fn();

    controller = new CitaController(
      mockListUseCase as never,
      mockGetUseCase as never,
      mockCreateUseCase as never,
      mockCambiarEstadoUseCase as never,
      mockCancelUseCase as never,
      mockCompletarUseCase as never,
    );
  });

  describe('list', () => {
    it('should return citas list', async () => {
      mockListUseCase.execute.mockResolvedValue([mockCita]);

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(res.json).toHaveBeenCalledWith([mockCita]);
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        desde: undefined,
        hasta: undefined,
        usuarioId: undefined,
        clienteId: undefined,
        estado: undefined,
      });
    });

    it('should pass query filters', async () => {
      mockListUseCase.execute.mockResolvedValue([mockCita]);

      const req = {
        salonId: 1,
        query: { usuarioId: '2', estado: 'PENDIENTE' },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        desde: undefined,
        hasta: undefined,
        usuarioId: 2,
        clienteId: undefined,
        estado: 'PENDIENTE',
      });
    });

    it('should call next on error', async () => {
      const error = new Error('DB error');
      mockListUseCase.execute.mockRejectedValue(error);

      const req = { salonId: 1, query: {} } as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('get', () => {
    it('should return single cita', async () => {
      mockGetUseCase.execute.mockResolvedValue(mockCita);

      const req = { params: { id: '1' } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.get(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockCita);
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('create', () => {
    it('should return 201 with created cita', async () => {
      mockCreateUseCase.execute.mockResolvedValue(mockCita);

      const req = {
        salonId: 1,
        body: {
          usuarioId: 1,
          clienteId: 1,
          fechaHora: '2026-06-01T10:00:00.000Z',
          serviciosIds: [1, 2],
          notas: 'Primera visita',
        },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCita);
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith({
        salonId: 1,
        usuarioId: 1,
        clienteId: 1,
        fechaHora: new Date('2026-06-01T10:00:00.000Z'),
        servicioIds: [1, 2],
        notas: 'Primera visita',
        esWalkIn: undefined,
      });
    });
  });

  describe('cambiarEstado', () => {
    it('should update estado and return cita', async () => {
      mockCambiarEstadoUseCase.execute.mockResolvedValue({
        ...mockCita,
        estado: 'CONFIRMADA',
      });

      const req = {
        params: { id: '1' },
        body: { estado: 'CONFIRMADA' },
        user: { id: 1 },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cambiarEstado(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'CONFIRMADA' }),
      );
      expect(mockCambiarEstadoUseCase.execute).toHaveBeenCalledWith({
        id: 1,
        estado: 'CONFIRMADA',
        usuarioId: 1,
      });
    });
  });

  describe('cancelar', () => {
    it('should cancel and return cita', async () => {
      mockCancelUseCase.execute.mockResolvedValue({
        ...mockCita,
        estado: 'CANCELADA',
      });

      const req = { params: { id: '1' }, user: { id: 1 } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.cancelar(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'CANCELADA' }),
      );
      expect(mockCancelUseCase.execute).toHaveBeenCalledWith({ id: 1, usuarioId: 1 });
    });
  });

  describe('completar', () => {
    it('should complete and return cita', async () => {
      mockCompletarUseCase.execute.mockResolvedValue({
        ...mockCita,
        estado: 'COMPLETADA',
      });

      const req = { params: { id: '1' }, user: { id: 1 } } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.completar(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'COMPLETADA' }),
      );
      expect(mockCompletarUseCase.execute).toHaveBeenCalledWith({ id: 1, usuarioId: 1 });
    });
  });
});
