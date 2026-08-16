import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { CompletarCitaUseCase } from '../CompletarCitaUseCase';
import { NotFoundError, CajaCerradaError } from '../../../../../../shared/errors';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';

function makeMockCita(estado: EstadoCita, overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    salonId: 3,
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

describe('CompletarCitaUseCase', () => {
  let useCase: CompletarCitaUseCase;

  const mocks = () => ({
    citaRepo: {
      findById: vi.fn(),
      cambiarEstado: vi.fn(),
    },
    cajaRepo: {
      findAbiertaBySalonYFecha: vi.fn(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw CajaCerradaError and leave the cita CONFIRMADA when no caja is open', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    useCase = new CompletarCitaUseCase(repo.citaRepo as never, repo.cajaRepo as never);

    await expect(useCase.execute({ id: 1, usuarioId: 2 })).rejects.toThrow(CajaCerradaError);

    // La regla de oro corre contra el salonId de la cita y NO se persiste nada
    expect(repo.cajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(repo.citaRepo.cambiarEstado).not.toHaveBeenCalled();
    expect(cita.estado).toBe(EstadoCita.CONFIRMADA);
  });

  it('should complete the cita when a caja is open', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });
    repo.citaRepo.cambiarEstado.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

    useCase = new CompletarCitaUseCase(repo.citaRepo as never, repo.cajaRepo as never);

    const result = await useCase.execute({ id: 1, usuarioId: 2 });

    expect(repo.citaRepo.cambiarEstado).toHaveBeenCalledWith(1, EstadoCita.COMPLETADA, {
      completadoPorId: 2,
    });
    expect(result.estado).toBe(EstadoCita.COMPLETADA);
  });

  it('should throw NotFoundError for a non-existent cita', async () => {
    const repo = mocks();
    repo.citaRepo.findById.mockResolvedValue(null);

    useCase = new CompletarCitaUseCase(repo.citaRepo as never, repo.cajaRepo as never);

    await expect(useCase.execute({ id: 999 })).rejects.toThrow(NotFoundError);
    expect(repo.cajaRepo.findAbiertaBySalonYFecha).not.toHaveBeenCalled();
  });
});
