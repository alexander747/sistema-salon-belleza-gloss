import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CuentasPagarUseCase } from '../CuentasPagarUseCase';

// ── Fakes ─────────────────────────────────────────────────────
const mockNominaUseCase = { execute: vi.fn() };
const mockHistorialUseCase = { execute: vi.fn() };
const mockUsuarioRepo = { findBySalon: vi.fn() };

const makeNominaEntry = (overrides: Record<string, unknown> = {}) => ({
  empleadaId: 1,
  nombre: 'Ana',
  sueldoFijo: 0,
  porcentajeComisionServicio: 30,
  totalAPagar: 0,
  ...overrides,
});

const makeLiquidacion = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  salonId: 1,
  usuarioId: 1,
  totalPagado: 0,
  ...overrides,
});

const makeUsuario = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  nombre: 'Ana',
  sueldoFijo: 0,
  porcentajeComisionServicio: 30,
  ...overrides,
});

describe('CuentasPagarUseCase', () => {
  let useCase: CuentasPagarUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CuentasPagarUseCase(
      mockNominaUseCase as never,
      mockHistorialUseCase as never,
      mockUsuarioRepo as never,
    );
  });

  it('combina pendienteActual (nómina) con liquidadoAcumulado (suma de totalPagado del historial)', async () => {
    mockNominaUseCase.execute.mockResolvedValue([
      makeNominaEntry({ empleadaId: 1, nombre: 'Ana', totalAPagar: 298000 }),
    ]);
    mockHistorialUseCase.execute.mockResolvedValue([
      makeLiquidacion({ usuarioId: 1, totalPagado: 250000 }),
      makeLiquidacion({ usuarioId: 1, totalPagado: 300000 }),
    ]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeUsuario({ id: 1, nombre: 'Ana', sueldoFijo: 0, porcentajeComisionServicio: 30 }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(mockNominaUseCase.execute).toHaveBeenCalledWith({ salonId: 1 });
    expect(mockHistorialUseCase.execute).toHaveBeenCalledWith({ salonId: 1 });
    expect(mockUsuarioRepo.findBySalon).toHaveBeenCalledWith(1);
    expect(result.data).toEqual([
      {
        empleadaId: 1,
        nombre: 'Ana',
        sueldoFijo: 0,
        porcentajeComisionServicio: 30,
        pendienteActual: 298000,
        liquidadoAcumulado: 550000,
      },
    ]);
  });

  it('incluye empleada presente solo en el historial con pendienteActual=0', async () => {
    mockNominaUseCase.execute.mockResolvedValue([]);
    mockHistorialUseCase.execute.mockResolvedValue([
      makeLiquidacion({ usuarioId: 2, totalPagado: 200000 }),
    ]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeUsuario({ id: 2, nombre: 'Bety', sueldoFijo: 0, porcentajeComisionServicio: 25 }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([
      {
        empleadaId: 2,
        nombre: 'Bety',
        sueldoFijo: 0,
        porcentajeComisionServicio: 25,
        pendienteActual: 0,
        liquidadoAcumulado: 200000,
      },
    ]);
  });

  it('incluye empleada presente solo en la nómina con liquidadoAcumulado=0', async () => {
    mockNominaUseCase.execute.mockResolvedValue([
      makeNominaEntry({ empleadaId: 3, nombre: 'Caro', sueldoFijo: 500000, porcentajeComisionServicio: 0, totalAPagar: 500000 }),
    ]);
    mockHistorialUseCase.execute.mockResolvedValue([]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeUsuario({ id: 3, nombre: 'Caro', sueldoFijo: 500000, porcentajeComisionServicio: 0 }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([
      {
        empleadaId: 3,
        nombre: 'Caro',
        sueldoFijo: 500000,
        porcentajeComisionServicio: 0,
        pendienteActual: 500000,
        liquidadoAcumulado: 0,
      },
    ]);
  });

  it('preserva la frontera de mes de la nómina: empleada liquidada sin registros nuevos aparece con pendienteActual=0', async () => {
    // NominaPendienteUseCase excluye a la empleada (ya liquidada este mes, sin
    // registros posteriores) → su fila aquí refleja pendienteActual=0 y solo acumulado.
    mockNominaUseCase.execute.mockResolvedValue([]);
    mockHistorialUseCase.execute.mockResolvedValue([
      makeLiquidacion({ usuarioId: 4, totalPagado: 300000 }),
    ]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeUsuario({ id: 4, nombre: 'Dani', sueldoFijo: 0, porcentajeComisionServicio: 0 }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 0 });

    expect(result.data).toEqual([
      expect.objectContaining({
        empleadaId: 4,
        pendienteActual: 0,
        liquidadoAcumulado: 300000,
      }),
    ]);
  });

  it('ordena por empleadaId y pagina', async () => {
    mockNominaUseCase.execute.mockResolvedValue([
      makeNominaEntry({ empleadaId: 5, nombre: 'Eli', totalAPagar: 100000 }),
      makeNominaEntry({ empleadaId: 6, nombre: 'Fani', totalAPagar: 200000 }),
      makeNominaEntry({ empleadaId: 7, nombre: 'Gina', totalAPagar: 300000 }),
    ]);
    mockHistorialUseCase.execute.mockResolvedValue([]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([
      makeUsuario({ id: 5, nombre: 'Eli' }),
      makeUsuario({ id: 6, nombre: 'Fani' }),
      makeUsuario({ id: 7, nombre: 'Gina' }),
    ]);

    const result = await useCase.execute({ salonId: 1, page: 2, limit: 2 });

    expect(result.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].empleadaId).toBe(7);
  });

  it('devuelve lista vacía cuando no hay nómina ni historial', async () => {
    mockNominaUseCase.execute.mockResolvedValue([]);
    mockHistorialUseCase.execute.mockResolvedValue([]);
    mockUsuarioRepo.findBySalon.mockResolvedValue([]);

    const result = await useCase.execute({ salonId: 1, page: 1, limit: 10 });

    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(result.data).toEqual([]);
  });
});
