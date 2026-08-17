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

// Mock database: CompletarCitaUseCase es dueño de la transacción (queryRunner)
let mockQueryRunner: ReturnType<typeof makeQueryRunner>;
function makeQueryRunner() {
  return {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
    manager: { getRepository: vi.fn() },
  };
}
vi.mock('../../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => {
      mockQueryRunner = makeQueryRunner();
      return mockQueryRunner;
    }),
  },
}));

import { CompletarCitaUseCase } from '../CompletarCitaUseCase';
import { NotFoundError, CajaCerradaError, UnprocessableEntityError } from '../../../../../../shared/errors';
import { EstadoCita } from '../../../../../../infrastructure/persistence/entities/CitaEntity';
import type { CreateRegistroInputConCita } from '../../../../../finanzas/application/use-cases/registro/CreateRegistroUseCase';

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

function makeRegistroPayload(
  overrides: Partial<CreateRegistroInputConCita> = {},
): CreateRegistroInputConCita {
  return {
    salonId: 999, // jamás debe usarse: el salonId viene de la cita
    clienteId: 1,
    usuarioId: 2,
    totalServicios: 50000,
    totalProductos: 0,
    propina: 0,
    esRetoque: false,
    divisiones: [],
    porcentajeDescuento: 0,
    productosVendidos: [],
    pagos: [{ monto: 50000, metodoPago: 'EFECTIVO' }],
    serviciosItems: [{ servicioId: 1, nombreServicio: 'Corte', precioServicio: 25000 }],
    ...overrides,
  };
}

const mockRegistroDTO = {
  id: 99,
  salonId: 3,
  clienteId: 1,
  usuarioId: 2,
  estado: 'ACTIVO',
  totalServicios: 50000,
  totalProductos: 0,
  montoTotal: 50000,
  montoPendiente: 0,
  propina: 0,
  comisionCalculada: 0,
  esRetoque: false,
  descripcionServicio: null,
  estaPagadaEmpleada: false,
  notas: null,
  precioAjustado: false,
  porcentajeDescuento: 0,
  valorOriginal: 50000,
  valorFinal: 50000,
  pagos: [{ id: 1, monto: 50000, metodoPago: 'EFECTIVO', referencia: null, creadoEn: new Date() }],
  divisiones: [],
  productosVendidos: [],
  serviciosItems: [],
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

describe('CompletarCitaUseCase', () => {
  let useCase: CompletarCitaUseCase;
  let createRegistroUseCase: { execute: ReturnType<typeof vi.fn> };

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
    mockQueryRunner = undefined as never;
    createRegistroUseCase = { execute: vi.fn() };
  });

  const buildUseCase = (repo: ReturnType<typeof mocks>) => {
    return new CompletarCitaUseCase(
      repo.citaRepo as never,
      repo.cajaRepo as never,
      createRegistroUseCase as never,
    );
  };

  it('should throw CajaCerradaError and leave the cita CONFIRMADA when no caja is open', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    useCase = buildUseCase(repo);

    await expect(useCase.execute({ id: 1, usuarioId: 2 })).rejects.toThrow(CajaCerradaError);

    // La regla de oro corre contra el salonId de la cita y NO se persiste nada
    expect(repo.cajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(repo.citaRepo.cambiarEstado).not.toHaveBeenCalled();
    expect(createRegistroUseCase.execute).not.toHaveBeenCalled();
    expect(cita.estado).toBe(EstadoCita.CONFIRMADA);
  });

  it('should keep legacy behavior: no registro → complete cita, return CitaDTO only', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });
    repo.citaRepo.cambiarEstado.mockResolvedValue(makeMockCita(EstadoCita.COMPLETADA));

    useCase = buildUseCase(repo);

    const result = await useCase.execute({ id: 1, usuarioId: 2 });

    // Sin registro → CitaDTO pelado (compatibilidad legacy), sin transacción
    expect(repo.citaRepo.cambiarEstado).toHaveBeenCalledWith(1, EstadoCita.COMPLETADA, {
      completadoPorId: 2,
    });
    expect(createRegistroUseCase.execute).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('cita');
    expect((result as { estado: string }).estado).toBe(EstadoCita.COMPLETADA);
    expect(mockQueryRunner).toBeUndefined();
  });

  it('should create registro and complete cita in ONE transaction, re-fetching after commit', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    const citaCompletada = makeMockCita(EstadoCita.COMPLETADA);
    repo.citaRepo.findById
      .mockResolvedValueOnce(cita)
      .mockResolvedValueOnce(citaCompletada); // re-fetch AFTER commit
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });
    repo.citaRepo.cambiarEstado.mockResolvedValue(citaCompletada);
    createRegistroUseCase.execute.mockResolvedValue(mockRegistroDTO);

    useCase = buildUseCase(repo);

    const result = await useCase.execute({
      id: 1,
      usuarioId: 2,
      registro: makeRegistroPayload(),
    });

    // salonId viene de la cita (3), NUNCA del cliente (999); citaId se inyecta
    expect(createRegistroUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 3, citaId: 1, clienteId: 1 }),
      mockQueryRunner,
    );
    // El estado se persiste en la MISMA transacción
    expect(repo.citaRepo.cambiarEstado).toHaveBeenCalledWith(
      1,
      EstadoCita.COMPLETADA,
      { completadoPorId: 2 },
      mockQueryRunner,
    );
    // Un solo queryRunner: connect → start → commit → release, sin rollback
    expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    // Re-fetch AFTER commit con repo default
    expect(repo.citaRepo.findById).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      cita: expect.objectContaining({ estado: EstadoCita.COMPLETADA }),
      registro: mockRegistroDTO,
    });
  });

  it('should rollback everything when the registro creation fails inside the transaction', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });
    createRegistroUseCase.execute.mockRejectedValue(new Error('fallo registro'));

    useCase = buildUseCase(repo);

    await expect(
      useCase.execute({ id: 1, usuarioId: 2, registro: makeRegistroPayload() }),
    ).rejects.toThrow('fallo registro');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    // El estado de la cita NO se tocó
    expect(repo.citaRepo.cambiarEstado).not.toHaveBeenCalled();
  });

  it('should rollback when cambiarEstado fails inside the transaction', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.CONFIRMADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });
    createRegistroUseCase.execute.mockResolvedValue(mockRegistroDTO);
    repo.citaRepo.cambiarEstado.mockRejectedValue(new Error('db caída'));

    useCase = buildUseCase(repo);

    await expect(
      useCase.execute({ id: 1, usuarioId: 2, registro: makeRegistroPayload() }),
    ).rejects.toThrow('db caída');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should reject PENDIENTE cita with 422 BEFORE any write (no qr, no registro)', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.PENDIENTE);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });

    useCase = buildUseCase(repo);

    await expect(
      useCase.execute({ id: 1, usuarioId: 2, registro: makeRegistroPayload() }),
    ).rejects.toThrow(UnprocessableEntityError);

    // Nada se escribió: ni registro, ni estado, ni transacción abierta
    expect(createRegistroUseCase.execute).not.toHaveBeenCalled();
    expect(repo.citaRepo.cambiarEstado).not.toHaveBeenCalled();
    expect(mockQueryRunner).toBeUndefined();
    expect(cita.estado).toBe(EstadoCita.PENDIENTE);
  });

  it('should reject a retry on an already-COMPLETADA cita with 422 (no duplicate registro)', async () => {
    const repo = mocks();
    const cita = makeMockCita(EstadoCita.COMPLETADA);
    repo.citaRepo.findById.mockResolvedValue(cita);
    repo.cajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 3, estado: 'ABIERTA' });

    useCase = buildUseCase(repo);

    await expect(
      useCase.execute({ id: 1, usuarioId: 2, registro: makeRegistroPayload() }),
    ).rejects.toThrow(UnprocessableEntityError);

    expect(createRegistroUseCase.execute).not.toHaveBeenCalled();
    expect(mockQueryRunner).toBeUndefined();
  });

  it('should throw NotFoundError for a non-existent cita', async () => {
    const repo = mocks();
    repo.citaRepo.findById.mockResolvedValue(null);

    useCase = buildUseCase(repo);

    await expect(useCase.execute({ id: 999 })).rejects.toThrow(NotFoundError);
    expect(repo.cajaRepo.findAbiertaBySalonYFecha).not.toHaveBeenCalled();
  });
});
