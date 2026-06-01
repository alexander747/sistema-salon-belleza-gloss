import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { DisponibilidadController } from '../DisponibilidadController';

describe('DisponibilidadController', () => {
  let controller: DisponibilidadController;
  let mockService: { verificar: ReturnType<typeof vi.fn>; obtenerSlots: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockService = { verificar: vi.fn(), obtenerSlots: vi.fn() };
    next = vi.fn();

    controller = new DisponibilidadController(mockService as never);
  });

  describe('verificar', () => {
    it('should return disponibilidad result', async () => {
      const expected = { disponible: true };
      mockService.verificar.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: {
          usuarioId: '1',
          fecha: '2026-06-01',
          hora: '10:00',
          duracionMinutos: '60',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.verificar(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockService.verificar).toHaveBeenCalledWith(
        1, 1, new Date('2026-06-01T10:00:00'), 60,
      );
    });

    it('should default duracionMinutos to 60 when not provided', async () => {
      mockService.verificar.mockResolvedValue({ disponible: true });

      const req = {
        salonId: 1,
        query: {
          usuarioId: '1',
          fecha: '2026-06-01',
          hora: '10:00',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.verificar(req, res, next);

      expect(mockService.verificar).toHaveBeenCalledWith(
        1, 1, new Date('2026-06-01T10:00:00'), 60,
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Service error');
      mockService.verificar.mockRejectedValue(error);

      const req = {
        salonId: 1,
        query: {
          usuarioId: '1',
          fecha: '2026-06-01',
          hora: '10:00',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.verificar(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('obtenerSlots', () => {
    it('should return slots array', async () => {
      const expected = [
        { hora: '09:00', disponible: true },
        { hora: '09:30', disponible: true },
      ];
      mockService.obtenerSlots.mockResolvedValue(expected);

      const req = {
        salonId: 1,
        query: {
          usuarioId: '1',
          fecha: '2026-06-01',
          hora: '10:00',
          duracionMinutos: '30',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.obtenerSlots(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expected);
      expect(mockService.obtenerSlots).toHaveBeenCalledWith(
        1, 1, new Date('2026-06-01T00:00:00'), 30,
      );
    });

    it('should call next on error', async () => {
      const error = new Error('Service error');
      mockService.obtenerSlots.mockRejectedValue(error);

      const req = {
        salonId: 1,
        query: {
          usuarioId: '1',
          fecha: '2026-06-01',
          hora: '10:00',
        },
      } as unknown as Request;
      const res = { json: vi.fn() } as unknown as Response;

      await controller.obtenerSlots(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
