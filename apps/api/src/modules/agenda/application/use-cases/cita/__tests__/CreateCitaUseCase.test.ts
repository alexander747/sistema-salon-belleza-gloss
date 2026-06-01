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

import { CreateCitaUseCase } from '../CreateCitaUseCase';
import { NotFoundError, UnprocessableEntityError } from '../../../../../../shared/errors';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';

function makeMockCliente(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Cliente Test',
    telefono: '+5411111111',
    ...overrides,
  };
}

function makeMockUsuario(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Empleada Test',
    email: 'test@test.com',
    ...overrides,
  };
}

function makeMockServicio(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Manicure',
    duracionMinutos: 60,
    precioBase: 1000,
    ...overrides,
  };
}

function makeMockCita(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: new Date('2026-06-01T10:00:00'),
    estado: EstadoCita.PENDIENTE,
    notas: null,
    esWalkIn: false,
    servicios: [makeMockServicio()],
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('CreateCitaUseCase', () => {
  const createMocks = () => ({
    citaRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findActiveByUsuario: vi.fn(),
      cambiarEstado: vi.fn(),
    },
    disponibilidadService: {
      verificar: vi.fn(),
      obtenerSlots: vi.fn(),
    },
    clienteRepo: {
      findBySalonAndId: vi.fn(),
    },
    usuarioRepo: {
      findBySalonAndId: vi.fn(),
    },
    servicioRepo: {
      findBySalonAndId: vi.fn(),
    },
  });

  const validInput = {
    salonId: 1,
    usuarioId: 1,
    clienteId: 1,
    fechaHora: new Date('2026-06-01T10:00:00'),
    servicioIds: [1, 2],
  };

  it('should create cita when all validations pass', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(makeMockCliente());
    mocks.usuarioRepo.findBySalonAndId.mockResolvedValue(makeMockUsuario());
    mocks.servicioRepo.findBySalonAndId
      .mockResolvedValueOnce(makeMockServicio({ id: 1, duracionMinutos: 60 }))
      .mockResolvedValueOnce(makeMockServicio({ id: 2, duracionMinutos: 30 }));
    mocks.disponibilidadService.verificar.mockResolvedValue({ disponible: true });
    mocks.citaRepo.create.mockResolvedValue(makeMockCita());

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    const result = await useCase.execute(validInput);

    expect(result).toBeDefined();
    expect(result.estado).toBe(EstadoCita.PENDIENTE);
    expect(mocks.disponibilidadService.verificar).toHaveBeenCalledWith(
      1, 1, validInput.fechaHora, 90, // 60 + 30 min total
    );
    expect(mocks.citaRepo.create).toHaveBeenCalled();
  });

  it('should throw NotFoundError when cliente does not exist', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(null);

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when usuario does not exist', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(makeMockCliente());
    mocks.usuarioRepo.findBySalonAndId.mockResolvedValue(null);

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when servicio does not exist', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(makeMockCliente());
    mocks.usuarioRepo.findBySalonAndId.mockResolvedValue(makeMockUsuario());
    mocks.servicioRepo.findBySalonAndId
      .mockResolvedValueOnce(makeMockServicio({ id: 1 }))
      .mockResolvedValueOnce(null);

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    await expect(useCase.execute(validInput)).rejects.toThrow(NotFoundError);
  });

  it('should throw UnprocessableEntityError when slot is unavailable', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(makeMockCliente());
    mocks.usuarioRepo.findBySalonAndId.mockResolvedValue(makeMockUsuario());
    mocks.servicioRepo.findBySalonAndId
      .mockResolvedValueOnce(makeMockServicio({ id: 1 }))
      .mockResolvedValueOnce(makeMockServicio({ id: 2 }));
    mocks.disponibilidadService.verificar.mockResolvedValue({
      disponible: false,
      motivo: 'Conflicto con cita existente',
    });

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    await expect(useCase.execute(validInput)).rejects.toThrow(UnprocessableEntityError);
  });

  it('should calculate total duration from all servicios', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId.mockResolvedValue(makeMockCliente());
    mocks.usuarioRepo.findBySalonAndId.mockResolvedValue(makeMockUsuario());
    mocks.servicioRepo.findBySalonAndId
      .mockResolvedValueOnce(makeMockServicio({ id: 1, duracionMinutos: 45 }))
      .mockResolvedValueOnce(makeMockServicio({ id: 2, duracionMinutos: 30 }));
    mocks.disponibilidadService.verificar.mockResolvedValue({ disponible: true });
    mocks.citaRepo.create.mockResolvedValue(makeMockCita());

    const useCase = new CreateCitaUseCase(
      mocks.citaRepo as any,
      mocks.disponibilidadService as any,
      mocks.clienteRepo as any,
      mocks.usuarioRepo as any,
      mocks.servicioRepo as any,
    );

    await useCase.execute(validInput);

    expect(mocks.disponibilidadService.verificar).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Date),
      75, // 45 + 30
    );
  });
});
