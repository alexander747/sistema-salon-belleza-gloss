import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database: queryRunner pattern (mismo que CreateRegistroUseCase.test.ts)
const mockRepoCreate = vi.fn();
const mockRepoSave = vi.fn();
const mockRepoUpdate = vi.fn();
const mockRepoFindOneBy = vi.fn();
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
          findOneBy: mockRepoFindOneBy,
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

  it('lanza error cuando la empleada no existe en el salón', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toThrow(
      'Empleada 2 no encontrada en el salón',
    );
    expect(mockRegistroRepo.search).not.toHaveBeenCalled();
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

  it('aplica descuentos por préstamos y descuenta del total dentro de la transacción', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([
      makeRegistro({ id: 1, comisionCalculada: 30000 }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockLiquidacionRepo.create.mockResolvedValue({ id: 12 });
    mockLiquidacionRepo.findById.mockResolvedValue({ id: 12, totalPagado: 180000 });
    mockPrestamoRepo.findById.mockResolvedValue({
      id: 7,
      usuarioId: 2,
      estado: 'ACTIVO',
      saldoPendiente: 100000,
    });
    mockRepoFindOneBy.mockResolvedValue({ id: 7, saldoPendiente: 100000 });

    const result = await useCase.execute({
      ...baseInput,
      descuentosPrestamos: [{ prestamoId: 7, monto: 50000 }],
    });

    // calculatedTotal = 30000 + 200000 = 230000 → neto = 230000 - 50000 = 180000
    expect(mockLiquidacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalPagado: 180000 }),
      expect.anything(),
    );
    // PagoPrestamo creado y guardado con el monto del descuento
    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 7,
        monto: 50000,
        tipoPago: 'LIQUIDACION',
        liquidacionId: 12,
      }),
    );
    expect(mockRepoSave).toHaveBeenCalled();
    // Saldo del préstamo actualizado: 100000 - 50000 = 50000 (sigue ACTIVO)
    expect(mockRepoUpdate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ saldoPendiente: 50000, estado: 'ACTIVO' }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 12, totalPagado: 180000 }));
  });

  it('rechaza descuentos que exceden el total a liquidar', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockPrestamoRepo.findById.mockResolvedValue({
      id: 7,
      usuarioId: 2,
      estado: 'ACTIVO',
      saldoPendiente: 300000,
    });

    await expect(
      useCase.execute({
        ...baseInput,
        descuentosPrestamos: [{ prestamoId: 7, monto: 300000 }],
      }),
    ).rejects.toThrow(UnprocessableEntityError);

    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza descuento mayor al saldo pendiente del préstamo', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockPrestamoRepo.findById.mockResolvedValue({
      id: 7,
      usuarioId: 2,
      estado: 'ACTIVO',
      saldoPendiente: 100000,
    });

    await expect(
      useCase.execute({
        ...baseInput,
        descuentosPrestamos: [{ prestamoId: 7, monto: 300000 }],
      }),
    ).rejects.toThrow('excede el saldo pendiente');

    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza descuento de un préstamo inexistente', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockPrestamoRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        descuentosPrestamos: [{ prestamoId: 99, monto: 10000 }],
      }),
    ).rejects.toThrow('Préstamo ID 99 no encontrado');

    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza descuento de un préstamo no activo', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockPrestamoRepo.findById.mockResolvedValue({
      id: 7,
      usuarioId: 2,
      estado: 'PAGADO',
      saldoPendiente: 100000,
    });

    await expect(
      useCase.execute({
        ...baseInput,
        descuentosPrestamos: [{ prestamoId: 7, monto: 10000 }],
      }),
    ).rejects.toThrow('no está activo');

    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('rechaza descuento de un préstamo que no pertenece a la empleada', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockPrestamoRepo.findById.mockResolvedValue({
      id: 7,
      usuarioId: 999,
      estado: 'ACTIVO',
      saldoPendiente: 100000,
    });

    await expect(
      useCase.execute({
        ...baseInput,
        descuentosPrestamos: [{ prestamoId: 7, monto: 10000 }],
      }),
    ).rejects.toThrow('no pertenece a esta empleada');

    expect(mockLiquidacionRepo.create).not.toHaveBeenCalled();
  });

  it('liquida registros NUEVOS posteriores a una liquidación previa en el período', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    // Dos registros: uno viejo (antes de la liquidación previa) y uno nuevo (después)
    mockRegistroRepo.search.mockResolvedValue([
      makeRegistro({ id: 1, comisionCalculada: 30000, creadoEn: new Date('2026-08-01T10:00:00') }),
      makeRegistro({ id: 2, comisionCalculada: 5000, creadoEn: new Date('2026-08-15T10:00:00') }),
    ]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([
      { id: 10, creadoEn: new Date('2026-08-10T10:00:00') },
    ]);
    mockLiquidacionRepo.create.mockResolvedValue({ id: 13 });
    mockLiquidacionRepo.findById.mockResolvedValue({ id: 13, totalPagado: 205000 });

    const result = await useCase.execute(baseInput);

    // Solo el registro nuevo (5000) entra: 5000 + 200000 = 205000
    expect(mockLiquidacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalComisiones: 5000,
        totalPagado: 205000,
      }),
      expect.anything(),
    );
    // Solo se marca pagado el registro nuevo
    expect(mockRegistroRepo.update).toHaveBeenCalledWith(2, expect.anything(), expect.anything());
    expect(mockRegistroRepo.update).not.toHaveBeenCalledWith(1, expect.anything(), expect.anything());
    expect(result).toEqual(expect.objectContaining({ id: 13, totalPagado: 205000 }));
  });

  it('hace rollback y re-lanza el error cuando falla la creación dentro de la transacción', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue(
      makeEmpleada({ id: 2, sueldoFijo: 200000 }),
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalonEmpleadaAndPeriodo.mockResolvedValue([]);
    mockLiquidacionRepo.create.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(baseInput)).rejects.toThrow('db down');

    const { AppDataSource } = await import('../../../../../../shared/database.js');
    const qr = (AppDataSource.createQueryRunner as unknown as { mock: { results: Array<{ value: { rollbackTransaction: () => unknown; release: () => unknown } }> } }).mock.results[0].value;
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
  });
});
