import { describe, it, expect } from 'vitest';
import { calcularReporteCierre, type MovimientoCajaInput, type GastoCajaInput } from '../calcularReporteCierre';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

// ── Helpers ───────────────────────────────────────────────────
const makeRegistro = (overrides: Partial<MovimientoCajaInput> & Record<string, unknown> = {}): MovimientoCajaInput => ({
  estado: EstadoRegistro.ACTIVO,
  totalServicios: 0,
  totalProductos: 0,
  comisionCalculada: 0,
  precioAjustado: false,
  valorOriginal: 0,
  valorFinal: 0,
  pagos: [],
  ...overrides,
} as MovimientoCajaInput);

const makeGasto = (overrides: Partial<GastoCajaInput> & Record<string, unknown> = {}): GastoCajaInput => ({
  monto: 0,
  metodoPago: 'EFECTIVO',
  ...overrides,
} as GastoCajaInput);

describe('calcularReporteCierre', () => {
  it('should compute montoEsperado cash-only y diferencia 0 cuando cuadra (pagos EFECTIVO 180000 − gastos EFECTIVO 20000)', () => {
    const registros = [
      makeRegistro({
        totalServicios: 180000,
        pagos: [{ monto: 180000, metodoPago: 'EFECTIVO' }],
      }),
    ];
    const gastos = [makeGasto({ monto: 20000 })];

    const reporte = calcularReporteCierre(registros, gastos, 160000);

    expect(reporte.montoEsperado).toBe(160000);
    expect(reporte.montoReal).toBe(160000);
    expect(reporte.diferencia).toBe(0);
  });

  it('should report diferencia negativa cuando el real es menor al esperado', () => {
    const registros = [
      makeRegistro({
        totalServicios: 180000,
        pagos: [{ monto: 180000, metodoPago: 'EFECTIVO' }],
      }),
    ];
    const gastos: never[] = [];

    const reporte = calcularReporteCierre(registros, gastos, 175000);

    expect(reporte.montoEsperado).toBe(180000);
    expect(reporte.diferencia).toBe(-5000);
  });

  it('should build the complete report with breakdown (owner decision: arqueo cash-only)', () => {
    const registros = [
      makeRegistro({
        id: 1,
        totalServicios: 150000,
        totalProductos: 60000,
        comisionCalculada: 56000,
        precioAjustado: true,
        valorOriginal: 160000,
        valorFinal: 150000, // descuento 10000
        pagos: [
          { monto: 120000, metodoPago: 'EFECTIVO' },
          { monto: 90000, metodoPago: 'TARJETA' },
        ],
      }),
      makeRegistro({
        id: 2,
        totalServicios: 90000,
        totalProductos: 0,
        comisionCalculada: 40000,
        pagos: [{ monto: 80000, metodoPago: 'EFECTIVO' }],
      }),
      makeRegistro({
        id: 3,
        totalServicios: 0,
        totalProductos: 0,
        comisionCalculada: 0,
        pagos: [],
      }),
    ];
    const gastos = [
      makeGasto({ monto: 20000 }),
      makeGasto({ monto: 10000, metodoPago: 'TRANSFERENCIA' }),
    ];

    const reporte = calcularReporteCierre(registros, gastos, 170000);

    expect(reporte.totalServicios).toBe(240000);
    expect(reporte.totalProductos).toBe(60000);
    expect(reporte.ingresosBrutos).toBe(300000);
    expect(reporte.descuentos).toBe(10000);
    expect(reporte.ingresosNetos).toBe(290000);
    expect(reporte.porMetodoPago).toEqual({ EFECTIVO: 200000, TARJETA: 90000, TRANSFERENCIA: 0 });
    expect(reporte.comisiones).toBe(96000);
    expect(reporte.totalGastos).toBe(30000);
    // Arqueo cash-only: EFECTIVO 200000 − gastos EFECTIVO 20000 = 180000
    expect(reporte.montoEsperado).toBe(180000);
    expect(reporte.diferencia).toBe(-10000);
    expect(reporte.cantidadMovimientos).toBe(5);
  });

  it('should exclude ANULADO registros from all totals', () => {
    const registros = [
      makeRegistro({
        id: 1,
        estado: EstadoRegistro.ANULADO,
        totalServicios: 999999,
        pagos: [{ monto: 999999, metodoPago: 'EFECTIVO' }],
      }),
      makeRegistro({
        id: 2,
        totalServicios: 50000,
        pagos: [{ monto: 50000, metodoPago: 'EFECTIVO' }],
      }),
    ];
    const gastos: never[] = [];

    const reporte = calcularReporteCierre(registros, gastos, 50000);

    expect(reporte.totalServicios).toBe(50000);
    expect(reporte.porMetodoPago.EFECTIVO).toBe(50000);
    expect(reporte.montoEsperado).toBe(50000);
    expect(reporte.cantidadMovimientos).toBe(1);
  });

  it('should leave montoReal y diferencia null cuando no hay montoRealEfectivo (preview)', () => {
    const registros = [
      makeRegistro({
        totalServicios: 100000,
        pagos: [{ monto: 100000, metodoPago: 'EFECTIVO' }],
      }),
    ];
    const gastos: never[] = [];

    const reporte = calcularReporteCierre(registros, gastos, null);

    expect(reporte.montoEsperado).toBe(100000);
    expect(reporte.montoReal).toBeNull();
    expect(reporte.diferencia).toBeNull();
  });
});
