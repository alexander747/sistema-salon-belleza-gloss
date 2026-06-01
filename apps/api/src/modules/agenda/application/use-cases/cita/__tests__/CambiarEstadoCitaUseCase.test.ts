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
import { NotFoundError, UnprocessableEntityError } from '../../../../../../shared/errors';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';

function makeMockCita(estado: EstadoCita, overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: new Date('2026-06-01T10:00:00'),
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

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      const result = await useCase.execute({ id: 1, estado: nuevo, usuarioId: 1 });

      expect(mocks.citaRepo.cambiarEstado).toHaveBeenCalledWith(1, nuevo, extraData);
      expect(result.estado).toBe(nuevo);
    });
  });

  describe('invalid transitions', () => {
    it('should reject COMPLETADA → PENDIENTE with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.PENDIENTE }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject CANCELADA → CONFIRMADA with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.CANCELADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.CONFIRMADA }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject NO_LLEGO → PENDIENTE with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.NO_LLEGO));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.PENDIENTE }),
      ).rejects.toThrow(UnprocessableEntityError);
    });

    it('should reject COMPLETADA → CANCELADA with 422', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      await expect(
        useCase.execute({ id: 1, estado: EstadoCita.CANCELADA }),
      ).rejects.toThrow(UnprocessableEntityError);
    });
  });

  describe('not found', () => {
    it('should throw NotFoundError for non-existent cita', async () => {
      const mocks = createMocks();
      mocks.citaRepo.findById.mockResolvedValue(null);

      const useCase = new CambiarEstadoCitaUseCase(mocks.citaRepo as any);

      await expect(
        useCase.execute({ id: 999, estado: EstadoCita.CONFIRMADA }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
