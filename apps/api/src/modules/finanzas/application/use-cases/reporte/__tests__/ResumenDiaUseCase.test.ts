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
  /** Current outstanding debt (legacy rows fall back to this when montoFiado is NULL). */
  montoPendiente?: number;
  /** Snapshot of the unpaid amount at sale time. NULL for legacy rows. */
  montoFiado?: number | null;
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
  montoPendiente: 0,
  ...overrides,
});

describe('ResumenDiaUseCase (approval — comportamiento actual)', () => {
  let useCase: ResumenDiaUseCase;
  let mockRegistroRepo: {
    findBySalonAndDateRange: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    sumPagosPorPeriodo: ReturnType<typeof vi.fn>;
    sumMontoPendientePorPeriodo: ReturnType<typeof vi.fn>;
    sumCobrosDeudaAnterior: ReturnType<typeof vi.fn>;
  };
  let mockGastoRepo: { sumBySalonAndDateRange: ReturnType<typeof vi.fn> };
  let mockDevolucionRepo: { sumBySalonAndDateRange: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = {
      findBySalonAndDateRange: vi.fn(),
      search: vi.fn(),
      sumPagosPorPeriodo: vi.fn(),
      sumMontoPendientePorPeriodo: vi.fn(),
      sumCobrosDeudaAnterior: vi.fn(),
    };
    mockGastoRepo = { sumBySalonAndDateRange: vi.fn() };
    mockDevolucionRepo = { sumBySalonAndDateRange: vi.fn() };
    useCase = new ResumenDiaUseCase(
      mockRegistroRepo as never,
      mockGastoRepo as never,
      mockDevolucionRepo as never,
    );
    mockGastoRepo.sumBySalonAndDateRange.mockResolvedValue(0);
    mockDevolucionRepo.sumBySalonAndDateRange.mockResolvedValue(0);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(0);
    mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(0);
    mockRegistroRepo.sumCobrosDeudaAnterior.mockResolvedValue(0);
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

  it('suma el costo real POR_GRAMO derivado (114000) aunque el cliente haya enviado 0', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 450000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 450000,
        serviciosItems: [{ costoBaseInsumos: 114000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalCostoBaseInsumos).toBe(114000);
  });

  it('suma múltiples líneas POR_GRAMO (114000 + 36000 = 150000)', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 500000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 500000,
        serviciosItems: [{ costoBaseInsumos: 114000 }, { costoBaseInsumos: 36000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalCostoBaseInsumos).toBe(150000);
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

  it('fixture lucía 2026-09-04..2026-09-29: insumos 84000 → balanceNeto 203400', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 555000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 555000,
        comisionCalculada: 267600,
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(555000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-09-04',
      hasta: '2026-09-29',
    });

    expect(result.totalIngresos).toBe(555000);
    expect(result.totalComisiones).toBe(267600);
    expect(result.totalCostoBaseInsumos).toBe(84000);
    expect(result.balanceNeto).toBe(203400);
  });

  it('registro ANULADO no aporta insumo ni altera el balance', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        estado: EstadoRegistro.ANULADO,
        totalServicios: 100000,
        montoTotal: 100000,
        comisionCalculada: 40000,
        serviciosItems: [{ costoBaseInsumos: 84000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-09-04',
      hasta: '2026-09-29',
    });

    expect(result.totalCostoBaseInsumos).toBe(0);
    expect(result.balanceNeto).toBe(0);
  });

  it('período sin registros → insumos 0 y balance 0', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-09-04',
      hasta: '2026-09-29',
    });

    expect(result.totalCostoBaseInsumos).toBe(0);
    expect(result.balanceNeto).toBe(0);
  });

  it('PR6a — expone cobrosDeudaAnterior y cumple la identidad de reconciliación del owner', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 5000,
        montoTotal: 105000,
        comisionCalculada: 0,
      }),
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(85000);
    mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(40000);
    mockRegistroRepo.sumCobrosDeudaAnterior.mockResolvedValue(20000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalIngresos).toBe(100000);
    expect(result.totalPropinas).toBe(5000);
    expect(result.totalFiadoDia).toBe(40000);
    expect(result.totalCobrado).toBe(85000);
    expect(result.cobrosDeudaAnterior).toBe(20000);
    // Identidad del owner: Cobrado = Ventas − Fiado + CobrosDeudaAnterior + Propinas
    expect(result.totalCobrado).toBe(
      result.totalIngresos - result.totalFiadoDia + result.cobrosDeudaAnterior + result.totalPropinas,
    );
  });

  it('PR6a — llama a sumCobrosDeudaAnterior con el período y los filtros de persona', async () => {
    mockRegistroRepo.search.mockResolvedValue([]);
    mockRegistroRepo.sumCobrosDeudaAnterior.mockResolvedValue(5000);

    const result = await useCase.execute({
      salonId: 1,
      fecha: '2026-05-15',
      usuarioId: 4,
    });

    expect(mockRegistroRepo.sumCobrosDeudaAnterior).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      expect.any(Date),
      4,
      undefined,
    );
    expect(result.cobrosDeudaAnterior).toBe(5000);
  });

  it('PR6a — sin cobros de deuda anterior → cobrosDeudaAnterior 0', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([]);
    mockRegistroRepo.sumCobrosDeudaAnterior.mockResolvedValue(0);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-09-04',
      hasta: '2026-09-29',
    });

    expect(result.cobrosDeudaAnterior).toBe(0);
  });

  it('incluye devoluciones del período y las resta en balanceNeto (concuerda con el P&L)', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 100000,
        comisionCalculada: 0,
      }),
    ]);
    mockDevolucionRepo.sumBySalonAndDateRange.mockResolvedValue(20000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalDevoluciones).toBe(20000);
    // 100000 ingresos − 0 gastos − 0 comisiones − 0 insumos − 20000 devoluciones
    expect(result.balanceNeto).toBe(80000);
    // Misma base que PyLMensualUseCase: devoluciones por creadoEn en [inicio, fin)
    expect(mockDevolucionRepo.sumBySalonAndDateRange).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('sin devoluciones → totalDevoluciones 0 y el balance no cambia', async () => {
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 100000,
        comisionCalculada: 0,
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.totalDevoluciones).toBe(0);
    expect(result.balanceNeto).toBe(100000);
  });

  describe('fiadoGenerado / fiadoPendiente / fiadoCobrado (snapshot at sale time)', () => {
    it('fiado generado y ya cobrado: generado 60000, pendiente 0, cobrado 60000', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({
          totalServicios: 60000,
          montoTotal: 60000,
          // Snapshot: 60000 was fiado at sale time.
          montoFiado: 60000,
          // Current pending is 0 because the debt was collected later.
          montoPendiente: 0,
        }),
        buildRegistro({
          totalServicios: 184000,
          montoTotal: 184000,
          montoFiado: 0,
          montoPendiente: 0,
        }),
      ]);
      // Current pending aggregate over the same period registros.
      mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(0);

      const result = await useCase.execute({ salonId: 1, fecha: '2026-10-01' });

      expect(result.fiadoGenerado).toBe(60000);
      expect(result.fiadoPendiente).toBe(0);
      expect(result.fiadoCobrado).toBe(60000);
    });

    it('fiado parcial: generado 60000, pendiente 20000, cobrado 40000', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({
          totalServicios: 60000,
          montoTotal: 60000,
          montoFiado: 60000,
          montoPendiente: 20000,
        }),
      ]);
      mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(20000);

      const result = await useCase.execute({ salonId: 1, fecha: '2026-10-01' });

      expect(result.fiadoGenerado).toBe(60000);
      expect(result.fiadoPendiente).toBe(20000);
      expect(result.fiadoCobrado).toBe(40000);
    });

    it('legacy NULL: cae al montoPendiente actual (generado 40000, pendiente 40000, cobrado 0)', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({
          totalServicios: 40000,
          montoTotal: 40000,
          montoFiado: null,
          montoPendiente: 40000,
        }),
      ]);
      mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(40000);

      const result = await useCase.execute({ salonId: 1, fecha: '2026-10-01' });

      expect(result.fiadoGenerado).toBe(40000);
      expect(result.fiadoPendiente).toBe(40000);
      expect(result.fiadoCobrado).toBe(0);
    });

    it('clamp: fiadoCobrado nunca es negativo', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({
          totalServicios: 5000,
          montoTotal: 5000,
          montoFiado: 0,
          montoPendiente: 5000,
        }),
      ]);
      mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(5000);

      const result = await useCase.execute({ salonId: 1, fecha: '2026-10-01' });

      expect(result.fiadoGenerado).toBe(0);
      expect(result.fiadoPendiente).toBe(5000);
      expect(result.fiadoCobrado).toBe(0);
    });

    it('excluye ANULADO del fiado generado', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({
          estado: EstadoRegistro.ANULADO,
          totalServicios: 90000,
          montoTotal: 90000,
          montoFiado: 90000,
          montoPendiente: 90000,
        }),
        buildRegistro({
          totalServicios: 10000,
          montoTotal: 10000,
          montoFiado: 10000,
          montoPendiente: 0,
        }),
      ]);
      mockRegistroRepo.sumMontoPendientePorPeriodo.mockResolvedValue(0);

      const result = await useCase.execute({ salonId: 1, fecha: '2026-10-01' });

      expect(result.fiadoGenerado).toBe(10000);
    });
  });

  describe('estado filter (summary mirrors the Registros table)', () => {
    it('ANULADOS reads only annulled registros and zeroes the money cards', async () => {
      mockRegistroRepo.search.mockResolvedValue([
        buildRegistro({
          estado: EstadoRegistro.ANULADO,
          totalServicios: 999999,
          totalProductos: 999999,
          montoTotal: 0,
          montoFiado: 999999,
          montoPendiente: 0,
        }),
      ]);

      const result = await useCase.execute({
        salonId: 1,
        desde: '2026-05-01',
        hasta: '2026-05-31',
        estado: 'ANULADOS',
      });

      // The annulled set is read through `search` with the estado filter...
      expect(mockRegistroRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({ salonId: 1, estado: 'ANULADOS' }),
      );
      expect(mockRegistroRepo.findBySalonAndDateRange).not.toHaveBeenCalled();
      // ...and annulled rows still contribute 0 (same rule as the table).
      expect(result.totalIngresos).toBe(0);
      expect(result.totalServicios).toBe(0);
      expect(result.totalProductos).toBe(0);
      expect(result.fiadoGenerado).toBe(0);
      expect(result.cantidadAtenciones).toBe(0);
    });

    it('TODOS reads the full set but annulled rows still contribute 0', async () => {
      mockRegistroRepo.search.mockResolvedValue([
        buildRegistro({
          totalServicios: 100000,
          montoTotal: 100000,
          propina: 5000,
        }),
        buildRegistro({
          estado: EstadoRegistro.ANULADO,
          totalServicios: 999999,
          montoTotal: 0,
        }),
      ]);

      const result = await useCase.execute({
        salonId: 1,
        desde: '2026-05-01',
        hasta: '2026-05-31',
        estado: 'TODOS',
      });

      expect(mockRegistroRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({ salonId: 1, estado: 'TODOS' }),
      );
      expect(mockRegistroRepo.findBySalonAndDateRange).not.toHaveBeenCalled();
      expect(result.totalIngresos).toBe(100000);
      expect(result.totalServicios).toBe(100000);
      expect(result.totalPropinas).toBe(5000);
      expect(result.cantidadAtenciones).toBe(1);
    });

    it('ACTIVOS reads through search excluding ANULADO', async () => {
      mockRegistroRepo.search.mockResolvedValue([
        buildRegistro({
          totalServicios: 80000,
          montoTotal: 80000,
        }),
      ]);

      const result = await useCase.execute({
        salonId: 1,
        desde: '2026-05-01',
        hasta: '2026-05-31',
        estado: 'ACTIVOS',
      });

      expect(mockRegistroRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({ salonId: 1, estado: 'ACTIVOS' }),
      );
      expect(mockRegistroRepo.findBySalonAndDateRange).not.toHaveBeenCalled();
      expect(result.totalIngresos).toBe(80000);
    });

    it('keeps the legacy path when estado is omitted (PRESERVE)', async () => {
      mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
        buildRegistro({ totalServicios: 60000, montoTotal: 60000 }),
      ]);

      const result = await useCase.execute({
        salonId: 1,
        desde: '2026-05-01',
        hasta: '2026-05-31',
      });

      expect(mockRegistroRepo.search).not.toHaveBeenCalled();
      expect(mockRegistroRepo.findBySalonAndDateRange).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result.totalIngresos).toBe(60000);
    });
  });
});
