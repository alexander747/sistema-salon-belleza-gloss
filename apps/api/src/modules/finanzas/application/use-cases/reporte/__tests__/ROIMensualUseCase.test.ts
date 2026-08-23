import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROIMensualUseCase } from '../ROIMensualUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

describe('ROIMensualUseCase', () => {
  let useCase: ROIMensualUseCase;
  let mockRegistroRepo: {
    findBySalonAndDateRange: ReturnType<typeof vi.fn>;
    sumPagosPorPeriodo: ReturnType<typeof vi.fn>;
  };
  let mockGastoRepo: { findBySalon: ReturnType<typeof vi.fn> };
  let mockLiquidacionRepo: { findBySalon: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = { findBySalonAndDateRange: vi.fn(), sumPagosPorPeriodo: vi.fn() };
    mockGastoRepo = { findBySalon: vi.fn() };
    mockLiquidacionRepo = { findBySalon: vi.fn() };
    useCase = new ROIMensualUseCase(
      mockRegistroRepo as never,
      mockGastoRepo as never,
      mockLiquidacionRepo as never,
    );
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(0);
    mockGastoRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalon.mockResolvedValue([]);
  });

  it('ingresos = cobrado del mes (cash), no las ventas devengadas (escenario spec)', async () => {
    // Ventas devengadas 4000000 pero solo cobrado 3500000 (500000 fiado)
    mockRegistroRepo.findBySalonAndDateRange.mockResolvedValue([
      { estado: EstadoRegistro.ACTIVO, totalServicios: 4000000, totalProductos: 0 },
    ]);
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(3500000);
    mockGastoRepo.findBySalon.mockResolvedValue([
      { fecha: new Date('2026-05-10'), monto: 800000, esGastoFijo: true },
    ]);
    mockLiquidacionRepo.findBySalon.mockResolvedValue([
      { creadoEn: new Date('2026-05-20'), totalPagado: 1200000 },
    ]);

    const result = await useCase.execute({ salonId: 1, mes: new Date('2026-05-15') });

    expect(result.ingresos).toBe(3500000);
    expect(result.gastosFijos).toBe(800000);
    expect(result.gastosOperativos).toBe(0);
    expect(result.nomina).toBe(1200000);
    // 3500000 − 800000 − 0 − 1200000
    expect(result.gananciaNeta).toBe(1500000);
    // El cobrado se consulta con los límites del mes pedido
    expect(mockRegistroRepo.sumPagosPorPeriodo).toHaveBeenCalledWith(
      1,
      new Date(2026, 4, 1, 0, 0, 0, 0),
      new Date(2026, 5, 0, 23, 59, 59, 999),
    );
  });

  it('sin datos en el mes devuelve ceros (escenario spec)', async () => {
    const result = await useCase.execute({ salonId: 1, mes: new Date('2026-05-15') });

    expect(result.ingresos).toBe(0);
    expect(result.gastosFijos).toBe(0);
    expect(result.gastosOperativos).toBe(0);
    expect(result.nomina).toBe(0);
    expect(result.gananciaNeta).toBe(0);
  });

  it('filtra gastos y liquidaciones solo del mes pedido', async () => {
    mockRegistroRepo.sumPagosPorPeriodo.mockResolvedValue(1000000);
    mockGastoRepo.findBySalon.mockResolvedValue([
      { fecha: new Date('2026-05-05'), monto: 300000, esGastoFijo: true },
      { fecha: new Date('2026-04-05'), monto: 999999, esGastoFijo: true }, // otro mes
      { fecha: new Date('2026-05-15'), monto: 70000, esGastoFijo: false },
    ]);
    mockLiquidacionRepo.findBySalon.mockResolvedValue([
      { creadoEn: new Date('2026-05-10'), totalPagado: 500000 },
      { creadoEn: new Date('2026-03-10'), totalPagado: 999999 }, // otro mes
    ]);

    const result = await useCase.execute({ salonId: 1, mes: new Date('2026-05-15') });

    expect(result.gastosFijos).toBe(300000);
    expect(result.gastosOperativos).toBe(70000);
    expect(result.nomina).toBe(500000);
    expect(result.gananciaNeta).toBe(130000); // 1000000 − 300000 − 70000 − 500000
  });
});
