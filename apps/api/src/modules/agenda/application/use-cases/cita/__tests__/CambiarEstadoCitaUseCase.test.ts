import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

// Mock entity module to prevent TypeORM decorator evaluation
vi.mock('../../../../../../infrastructure/persistence/entities/CitaEntity.js', () => ({
  EstadoCita: {
    PENDIENTE: 'PENDIENTE',
    CONFIRMADA: 'CONFIRMADA',
    COMPLETADA: 'COMPLETADA',
    CANCELADA: 'CANCELADA',
    NO_LLEGO: 'NO_LLEGO',
  },
}));

import { CambiarEstadoCitaUseCase } from '../CambiarEstadoCitaUseCase';
import { NotFoundError, UnprocessableEntityError, CajaCerradaError } from '../../../../../../shared/errors';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';

function makeMockCita(estado: EstadoCita, overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    // Hoy (fecha de negocio): el guard de COMPLETADA resuelve el día actual → 422 CAJA_CERRADA
    fechaHora: new Date(),
    estado,
    notas: null,
    esWalkIn: false,
    servicios: [{ id: 1, nombre: 'Manicure', duracionMinutos: 60, precioBase: 1000 }],
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('CambiarEstadoCitaUseCase', () => {
  const createMocks = () => ({
    citaRepo: {
      findById: vi.fn(),
      cambiarEstado: vi.fn(),
    },
    cajaRepo: {
      findAbiertaBySalonYFecha: vi.fn(),
    },
  });

  describe('valid transitions', () => {
    it.each([
      [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, { confirmadoPorId: 1 }],
      [EstadoCita.PENDIENTE, EstadoCita.CANCELADA, { canceladoPorId: 1 }],
      [EstadoCita.CONFIRMADA, EstadoCita.COMPLETADA, {}],
      [EstadoCita.CONFIRMADA, EstadoCita.NO_LLEGO, {}],
      [EstadoCita.CONFIRMADA, EstadoCita.CANCELADA, { canceladoPorId: 1 }],
    ])('should allow %s → %s', async (actual, nuevo, extraData) => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(actual));
      mocks.citaRepo.cambiarEstado.mockResolvedValue(makeMockCita(nuevo));
      // Caja abierta por defecto para que la transición a COMPLETADA pase el guard
      mocks.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA' });

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      const result = await useCase.execute({ id: 1, estado: nuevo, usuarioId: 1 });

      expect(mocks.citaRepo.cambiarEstado).toHaveBeenCalledWith(1, nuevo, extraData);
      expect(result.estado).toBe(nuevo);

      // La regla de oro SOLO aplica al estado COMPLETADA
      if (nuevo !== EstadoCita.COMPLETADA) {
        expect(mocks.cajaRepo.findAbiertaBySalonYFecha).not.toHaveBeenCalled();
      }
    });
  });

  describe('regla de oro (solo COMPLETADA)', () => {
    it('should throw CajaCerradaError when transitioning to COMPLETADA without an open caja', async () => {
      const mocks = createMocks();
      const cita = makeMockCita(EstadoCita.CONFIRMADA);
      mocks.citaRepo.findById.mockResolvedValue(cita);
      mocks.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.COMPLETADA, usuarioId: 1 }),
      ).rejects.toThrow(CajaCerradaError);

      // Estado intacto y nada persistido
      expect(mocks.citaRepo.cambiarEstado).not.toHaveBeenCalled();
      expect(cita.estado).toBe(EstadoCita.CONFIRMADA);
    });

    it('should resolver la caja por la fecha de la cita al completar (backfill)', async () => {
      const mocks = createMocks();
      const cita = makeMockCita(EstadoCita.CONFIRMADA, {
        fechaHora: new Date('2026-08-16T10:00:00.000Z'),
      });
      mocks.citaRepo.findById.mockResolvedValue(cita);
      mocks.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA' });
      mocks.citaRepo.cambiarEstado.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await useCase.execute({ id: 1, estado: EstadoCita.COMPLETADA, usuarioId: 1 });

      expect(mocks.cajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, '2026-08-16');
    });

    it('should NOT block CANCELADA when no caja is open', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.CONFIRMADA));
      mocks.citaRepo.cambiarEstado.mockResolvedValue(makeMockCita(EstadoCita.CANCELADA));
      mocks.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      const result = await useCase.execute({ id: 1, estado: EstadoCita.CANCELADA, usuarioId: 1 });

      expect(result.estado).toBe(EstadoCita.CANCELADA);
      expect(mocks.cajaRepo.findAbiertaBySalonYFecha).not.toHaveBeenCalled();
    });
  });

  describe('invalid transitions', () => {
    it('should reject COMPLETADA → PENDIENTE with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.PENDIENTE }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject CANCELADA → CONFIRMADA with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.CANCELADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.CONFIRMADA }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject NO_LLEGO → PENDIENTE with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.NO_LLEGO));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.PENDIENTE }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject COMPLETADA → CANCELADA with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.CANCELADA }),
      ).rejects.toThrow(UnprocessableEntityError);
    });
  });

  describe('not found', () => {
    it('should throw NotFoundError for non-existent cita', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(null);

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any, mocks.cajaRepo as any);

      await expect(
        useCase.execute({ id: 999, estado: EstadoCita.CONFIRMADA }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
