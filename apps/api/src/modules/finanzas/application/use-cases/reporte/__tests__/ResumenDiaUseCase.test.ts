import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumenDiaUseCase } from '../ResumenDiaUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

/**
 * Approval tests: capturan el comportamiento ACTUAL del loop de descuentos de
 * ResumenDiaUseCase. Se escriben antes del refactor a calculo-registro.ts y
 * deben seguir pasando idénticos después (refactor sin cambio de comportamiento).
 */

interface MockRegistro {
  estado: EstadoRegistro;
  totalServicios: number;
  totalProductos: number;
  montoTotal: number;
  propina: number;
  comisionCalculada: number;
  valorFinal?: number;
  cantidadProductosVendidos?: number;
  serviciosItems?: { costoBaseInsumos?: number }[];
}

const buildRegistro = (overrides: Partial<MockRegistro> = {}): MockRegistro => ({
  estado: EstadoRegistro.ACTIVO,
  totalServicios: 0,
  totalProductos: 0,
  montoTotal: 0,
  propina: 0,
  comisionCalculada: 0,
  cantidadProductosVendidos: 0,
  serviciosItems: [],
  ...overrides,
});

describe('ResumenDiaUseCase (approval — comportamiento actual)', () => {
  let useCase: ResumenDiaUseCase;
  let mockRegistroRepo: {
    findBySalonAndDateRange: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    sumPagosPorPeriodo: ReturnType<typeof vi.fn>;
    sumMontoPendientePorPeriodo: ReturnType<typeof vi.fn>;
  };
  let mockGastoRepo: { sumBySalonAndDateRange: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = {
      findBySalonAndDateRange: vi.fn(),
      search: vi.fn(),
      sumPagosPorPeriodo: vi.fn(),
      sumMontoPendientePorPeriodo: vi.fn(),
    };
    mockGastoRepo = { sumBySalonAndDateRange: vi.fn() };
    useCase = new ResumenDiaUseCase(mockRegistroRepo as never, mockGastoRepo as never);
    mockGastoRepo.sumBySalonAndDateRange.mockResolvedValue(0);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(0);
    mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(0);
  });

  it('aplica la proporción del descuento a servicios y productos en modo período', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 300000,
        totalProductos: 50000,
        propina: 15000,
        montoTotal: 365000,
        valorFinal: 330000, // 10% de descuento sobre serv+prod
        comisionCalculada: 48000,
        cantidadProductosVendidos: 2,
      }),
    ]);
    // Fixture de pago completo: cobrado = Σ valorFinal
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(330000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalServicios).toBe(270000);
    expect(result.totalProductos).toBe(45000);
    expect(result.totalPropinas).toBe(15000);
    expect(result.totalComisiones).toBe(48000);
    expect(result.totalIngresos).toBe(315000);
    expect(result.cantidadAtenciones).toBe(1);
    expect(result.cantidadProductosVendidos).toBe(2);
    expect(result.totalCobrado).toBe(330000);
    expect(result.totalFiadoDia).toBe(0);
  });

  it('día con venta fiada: totalIngresos devengado informativo, cobrado y fiado separados (escenario spec)', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 60000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 60000,
      }),
      buildRegistro({
        totalServicios: 40000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 40000,
      }),
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(40000);
    mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(60000);

    const result = await useCase.execute({
      salonId: 1,
      fecha: '2026-05-15',
    });

    expect(result.totalIngresos).toBe(100000);
    expect(result.totalCobrado).toBe(40000);
    expect(result.totalFiadoDia).toBe(60000);
  });

  it('excluye registros ANULADO del resumen', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        estado: EstadoRegistro.ANULADO,
        totalServicios: 999999,
        totalProductos: 999999,
        montoTotal: 1999998,
        propina: 0,
      }),
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 30000,
        montoTotal: 130000,
        propina: 15000,
      }),
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(130000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalServicios).toBe(100000);
    expect(result.totalProductos).toBe(30000);
    expect(result.totalIngresos).toBe(130000);
    expect(result.cantidadAtenciones).toBe(1);
    // El pago del registro ANULADO no suma al cobrado (lo excluye el repo)
    expect(result.totalCobrado).toBe(130000);
  });

  it('suma el costo base de insumos desde serviciosItems sin ajuste por descuento', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 100000,
        serviciosItems: [{ costoBaseInsumos: 30000 }, { costoBaseInsumos: 20000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalCostoBaseInsumos).toBe(50000);
  });

  it('filtra por usuarioId vía search cuando se pasa un empleado (single-day)', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        totalServicios: 80000,
        totalProductos: 20000,
        montoTotal: 100000,
        propina: 10000,
      }),
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(100000);

    const result = await useCase.execute({
      salonId: 1,
      fecha: '2026-05-15',
      usuarioId: 4,
    });

    expect(mockRegistroRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 1, usuarioId: 4 }),
    );
    // El total cobrado honra el mismo filtro de empleada (cash del día)
    expect(mockRegistroRepo.sumPagosPorPeriodo).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      expect.any(Date),
      4,
      undefined,
    );
    expect(result.totalIngresos).toBe(100000);
    expect(result.cantidadAtenciones).toBe(1);
    expect(result.totalCobrado).toBe(100000);
  });

  it('filtra el cobrado y el fiado por clienteId cuando se pasa un cliente (fix card Cobrado)', async () => {
    mockRegistroRepo.search.mockResolvedValue([]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(40000);
    mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(60000);

    const result = await useCase.execute({
      salonId: 1,
      fecha: '2026-05-15',
      clienteId: 7,
    });

    // El cobrado y el fiado honran el filtro de cliente (bug reportado: el card
    // Cobrado ignoraba clienteId y traía el total del salón)
    expect(mockRegistroRepo.sumPagosPorPeriodo).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      expect.any(Date),
      undefined,
      7,
    );
    expect(mockRegistroRepo.sumMontoPendientePorPeriodo).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      expect.any(Date),
      undefined,
      7,
    );
    expect(result.totalCobrado).toBe(40000);
    expect(result.totalFiadoDia).toBe(60000);
  });
});
