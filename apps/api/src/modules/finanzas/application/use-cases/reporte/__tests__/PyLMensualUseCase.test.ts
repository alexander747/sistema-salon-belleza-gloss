import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PyLMensualUseCase } from '../PyLMensualUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import { colombiaDayStartUTC, colombiaDayEndUTC } from '../../../../../../shared/colombia-date';

interface MockRegistro {
  estado: EstadoRegistro;
  totalServicios: number;
  totalProductos: number;
  montoTotal: number;
  propina: number;
  comisionCalculada: number;
  valorFinal?: number;
  serviciosItems?: { costoBaseInsumos?: number }[];
}

interface MockGasto {
  monto: number;
  esGastoFijo: boolean;
  categoria: string;
}

const buildRegistro = (overrides: Partial<MockRegistro> = {}): MockRegistro => ({
  estado: EstadoRegistro.ACTIVO,
  totalServicios: 0,
  totalProductos: 0,
  montoTotal: 0,
  propina: 0,
  comisionCalculada: 0,
  serviciosItems: [],
  ...overrides,
});

const buildGasto = (overrides: Partial<MockGasto> = {}): MockGasto => ({
  monto: 0,
  esGastoFijo: false,
  categoria: 'OTROS',
  ...overrides,
});

describe('PyLMensualUseCase', () => {
  let useCase: PyLMensualUseCase;
  let mockRegistroRepo: { search: ReturnType<typeof vi.fn> };
  let mockGastoRepo: { search: ReturnType<typeof vi.fn> };
  let mockDevolucionRepo: { sumBySalonAndDateRange: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = { search: vi.fn() };
    mockGastoRepo = { search: vi.fn() };
    mockDevolucionRepo = { sumBySalonAndDateRange: vi.fn() };
    useCase = new PyLMensualUseCase(
      mockRegistroRepo as never,
      mockGastoRepo as never,
      mockDevolucionRepo as never,
    );
    mockRegistroRepo.search.mockResolvedValue([]);
    mockGastoRepo.search.mockResolvedValue([]);
    mockDevolucionRepo.sumBySalonAndDateRange.mockResolvedValue(0);
  });

  it('calcula el P&L completo con todos los factores (escenario spec)', async () => {
    // 3 registros: brutos servicios=300000 / productos=50000, descuento 10%,
    // propinas=15000, comisiones=48000, insumos=60000
    const registros = [
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 20000,
        propina: 5000,
        montoTotal: 125000,
        valorFinal: 113000, // 10% off sobre 120000 + 5000 propina
        comisionCalculada: 16000,
        serviciosItems: [{ costoBaseInsumos: 20000 }, { costoBaseInsumos: 0 }],
      }),
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 20000,
        propina: 5000,
        montoTotal: 125000,
        valorFinal: 113000,
        comisionCalculada: 16000,
        serviciosItems: [{ costoBaseInsumos: 20000 }],
      }),
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 10000,
        propina: 5000,
        montoTotal: 115000,
        valorFinal: 104000, // 10% off sobre 110000 + 5000 propina
        comisionCalculada: 16000,
        serviciosItems: [{ costoBaseInsumos: 20000 }],
      }),
    ];
    mockRegistroRepo.search.mockResolvedValue(registros);
    mockGastoRepo.search.mockResolvedValue([
      buildGasto({ monto: 200000, esGastoFijo: true, categoria: 'ARRIENDO' }),
      buildGasto({ monto: 80000, esGastoFijo: false, categoria: 'SERVICIOS_PUBLICOS' }),
    ]);
    mockDevolucionRepo.sumBySalonAndDateRange.mockResolvedValue(20000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.ingresosBrutos).toBe(350000);
    expect(result.ingresosNetos).toBe(315000);
    expect(result.descuentos).toBe(35000);
    expect(result.totalServicios).toBe(270000);
    expect(result.totalProductos).toBe(45000);
    expect(result.propinas).toBe(15000);
    expect(result.comisiones).toBe(48000);
    expect(result.costoBaseInsumos).toBe(60000);
    expect(result.margenBruto).toBe(255000);
    expect(result.gastosFijos).toBe(200000);
    expect(result.gastosOperativos).toBe(80000);
    expect(result.gastosPorCategoria).toEqual({
      ARRIENDO: 200000,
      SERVICIOS_PUBLICOS: 80000,
    });
    expect(result.totalGastos).toBe(280000);
    expect(result.devoluciones).toBe(20000);
    expect(result.utilidadNeta).toBe(-93000);
    expect(result.cantidadAtenciones).toBe(3);
    expect(result.desde).toBe('2026-05-01');
    expect(result.hasta).toBe('2026-05-31');
  });

  it('período vacío devuelve todos los totales en cero', async () => {
    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result).toMatchObject({
      ingresosBrutos: 0,
      descuentos: 0,
      ingresosNetos: 0,
      totalServicios: 0,
      totalProductos: 0,
      propinas: 0,
      costoBaseInsumos: 0,
      margenBruto: 0,
      comisiones: 0,
      gastosFijos: 0,
      gastosOperativos: 0,
      gastosPorCategoria: {},
      totalGastos: 0,
      devoluciones: 0,
      utilidadNeta: 0,
      cantidadAtenciones: 0,
    });
  });

  it('deduce las devoluciones como línea explícita del período', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 100000,
      }),
    ]);
    mockDevolucionRepo.sumBySalonAndDateRange.mockResolvedValue(20000);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.devoluciones).toBe(20000);
    // 100000 − 0 insumos − 0 comisiones − 0 gastos − 20000 devolución
    expect(result.utilidadNeta).toBe(80000);
  });

  it('excluye registros ANULADO del P&L', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        estado: EstadoRegistro.ANULADO,
        totalServicios: 900000,
        totalProductos: 900000,
        montoTotal: 1800000,
        propina: 0,
      }),
      buildRegistro({
        totalServicios: 100000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 100000,
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.ingresosBrutos).toBe(100000);
    expect(result.cantidadAtenciones).toBe(1);
  });

  it('agrupa gastos por categoría y suma repetidos', async () => {
    mockGastoRepo.search.mockResolvedValue([
      buildGasto({ monto: 50000, esGastoFijo: false, categoria: 'MARKETING' }),
      buildGasto({ monto: 30000, esGastoFijo: false, categoria: 'MARKETING' }),
      buildGasto({ monto: 10000, esGastoFijo: true, categoria: 'ARRIENDO' }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(result.gastosPorCategoria).toEqual({ MARKETING: 80000, ARRIENDO: 10000 });
    expect(result.gastosOperativos).toBe(80000);
    expect(result.gastosFijos).toBe(10000);
    expect(result.totalGastos).toBe(90000);
  });

  it('usa fechas Colombia (05:00 UTC) para registros y devoluciones; el filtro de usuario solo aplica a registros', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        totalServicios: 50000,
        totalProductos: 0,
        propina: 0,
        montoTotal: 50000,
      }),
    ]);
    mockGastoRepo.search.mockResolvedValue([
      buildGasto({ monto: 10000, esGastoFijo: false, categoria: 'OTROS' }),
    ]);

    await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
      usuarioId: 4,
    });

    expect(mockRegistroRepo.search).toHaveBeenCalledWith({
      salonId: 1,
      desde: colombiaDayStartUTC('2026-05-01'),
      hasta: colombiaDayEndUTC('2026-05-31'),
      usuarioId: 4,
    });
    // Gastos y devoluciones pertenecen al salón: no se filtran por empleada
    expect(mockGastoRepo.search).toHaveBeenCalledWith({
      salonId: 1,
      desde: new Date('2026-05-01T00:00:00.000Z'),
      hasta: new Date('2026-05-31T00:00:00.000Z'),
    });
    expect(mockDevolucionRepo.sumBySalonAndDateRange).toHaveBeenCalledWith(
      1,
      colombiaDayStartUTC('2026-05-01'),
      colombiaDayEndUTC('2026-05-31'),
    );
  });

  it('sin usuarioId el P&L no filtra por empleada', async () => {
    await useCase.execute({
      salonId: 1,
      desde: '2026-05-01',
      hasta: '2026-05-31',
    });

    expect(mockRegistroRepo.search).toHaveBeenCalledWith({
      salonId: 1,
      desde: colombiaDayStartUTC('2026-05-01'),
      hasta: colombiaDayEndUTC('2026-05-31'),
    });
  });
});
