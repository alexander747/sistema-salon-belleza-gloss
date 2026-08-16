import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database: queryRunner pattern (mismo que CreateRegistroUseCase.test.ts)
const mockRepoCreate = vi.fn();
const mockRepoSave = vi.fn();
const mockRepoUpdate = vi.fn();
vi.mock('../../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => ({
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        getRepository: vi.fn(() => ({
          update: mockRepoUpdate,
          create: mockRepoCreate,
          save: mockRepoSave,
        })),
      },
    })),
  },
}));

import { LiquidarEmpleadaUseCase } from '../LiquidarEmpleadaUseCase';
import { UnprocessableEntityError } from '../../../../../../shared/errors';

// ── Fakes ─────────────────────────────────────────────────────
const mockLiquidacionRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySalonEmpleadaAndPeriodo: vi.fn(),
};
const mockRegistroRepo = {
  search: vi.fn(),
  update: vi.fn(),
};
const mockUsuarioRepo = {
  findBySalonAndId: vi.fn(),
};
const mockPrestamoRepo = {
  findById: vi.fn(),
};
const mockPagoPrestamoRepo = {};

const makeEmpleada = (overrides: Record<string, unknown> = {}) => ({
  id: 2,
  nombre: 'Ana',
  rol: 4,
  sueldoFijo: 0,
  bonoHorario: 0,
  porcentajeComisionServicio: 0,
  ...overrides,
});

const makeRegistro = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  salonId: 1,
  usuarioId: 2,
  clienteId: 1,
  estado: 'ACTIVO',
  estaPagadaEmpleada: false,
  comisionCalculada: 0,
  propina: 0,
  creadoEn: new Date('2026-08-01T10:00:00'),
  ...overrides,
});

const baseInput = {
  salonId: 1,
  usuarioId: 2,
  periodoInicio: new Date('2026-08-01'),
  periodoFin: new Date('2026-08-31'),
};

describe('LiquidarEmpleadaUseCase', () => {
  let useCase: LiquidarEmpleadaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new LiquidarEmpleadaUseCase(
      mockLiquidacionRepo as never,
      mockRegistroRepo as never,
      mockUsuarioRepo as never,
      mockPrestamoRepo as never,
      mockPagoPrestamoRepo as never,
    );
  });

  it('liquida a empleada con solo sueldo fijo (0 registros) creando la liquidación con totalPagado = fijo + bono', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000, bonoHorario: 50000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockLiquidacionRepo.create.mockResolvedValue({ id: 10 });
    mockLiquidacionRepo.findById.mockResolvedValue({
      id: 10,
      salonId: 1,
      usuarioId: 2,
      totalComisiones: 0,
      totalPropinas: 0,
      sueldoFijo: 200000,
      bonoHorario: 50000,
      totalPagado: 250000,
      estado: 'PAGADA',
    });

    const result = await useCase.execute(baseInput);

    expect(mockLiquidacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 1,
        usuarioId: 2,
        totalComisiones: 0,
        totalPropinas: 0,
        sueldoFijo: 200000,
        bonoHorario: 50000,
        totalPagado: 250000,
        estado: 'PAGADA',
      }),
      expect.anything(),
    );
    expect(result).toEqual(expect.objectContaining({ id: 10, totalPagado: 250000 }));
  });

  it('lanza error 4xx cuando hay 0 registros y sueldoFijo/bonoHorario en 0', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(makeEmpleada({ id: 2 }));
    mockRegistroRepo.search.mockResolvedValue([]);

    await expect(useCase.execute(baseInput)).rejects.toThrow(UnprocessableEntityError);
    await expect(useCase.execute(baseInput)).rejects.toThrow('No hay registros pendientes para liquidar');
    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza el doble pago cuando ya fue liquidada en el período y no hay registros nuevos', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 10, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);

    await expect(useCase.execute(baseInput)).rejects.toThrow(/ya fue liquidada en el período/);
    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('liquida comisiones + propinas + sueldo fijo cuando hay registros pendientes', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([
      makeRegistro({ id: 1, comisionCalculada: 30000, propina: 5000 }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockLiquidacionRepo.create.mockResolvedValue({ id: 11 });
    mockLiquidacionRepo.findById.mockResolvedValue({ id: 11, totalPagado: 235000 });

    const result = await useCase.execute(baseInput);

    expect(mockLiquidacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalComisiones: 30000,
        totalPropinas: 5000,
        sueldoFijo: 200000,
        totalPagado: 235000,
      }),
      expect.anything(),
    );
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ estaPagadaEmpleada: true, liquidacionId: 11 }),
      expect.anything(),
    );
    expect(result).toEqual(expect.objectContaining({ id: 11, totalPagado: 235000 }));
  });

  it('no llama al queryRunner cuando la validación falla antes de la transacción', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(makeEmpleada({ id: 2 }));
    mockRegistroRepo.search.mockResolvedValue([]);

    await expect(useCase.execute(baseInput)).rejects.toThrow(UnprocessableEntityError);

    // createQueryRunner solo se invoca dentro del try de la transacción
    const { AppDataSource } = await import('../../../../../../shared/database.js');
    expect(AppDataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
