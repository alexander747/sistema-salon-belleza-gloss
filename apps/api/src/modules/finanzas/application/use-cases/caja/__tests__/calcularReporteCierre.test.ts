import { describe, it, expect } from 'vitest';
import { calcularReporteCierre, type MovimientoCajaInput, type GastoCajaInput, type PagoExtraCajaInput } from '../calcularReporteCierre';
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
  ...overrides,
} as MovimientoCajaInput);

const makeGasto = (overrides: Partial<GastoCajaInput> & Record<string, unknown> = {}): GastoCajaInput => ({
  monto: 0,
  metodoPago: 'EFECTIVO',
  ...overrides,
} as GastoCajaInput);

const makePago = (monto: number, metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'): PagoExtraCajaInput => ({
  monto,
  metodoPago,
});

describe('calcularReporteCierre', () => {
  it('should compute montoEsperado cash-only y diferencia 0 cuando cuadra (pagos EFECTIVO 180000 − gastos EFECTIVO 20000)', () => {
    const registros = [makeRegistro({ totalServicios: 180000 })];
    const gastos = [makeGasto({ monto: 20000 })];
    const pagosExtra = [makePago(180000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, 160000, 0, pagosExtra);

    expect(reporte.montoEsperado).toBe(160000);
    expect(reporte.montoReal).toBe(160000);
    expect(reporte.diferencia).toBe(0);
  });

  it('should report diferencia negativa cuando el real es menor al esperado', () => {
    const registros = [makeRegistro({ totalServicios: 180000 })];
    const gastos: never[] = [];
    const pagosExtra = [makePago(180000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, 175000, 0, pagosExtra);

    expect(reporte.montoEsperado).toBe(180000);
    expect(reporte.diferencia).toBe(-5000);
  });

  it('spec finanzas-caja: reporte con abono incluido — pago registro 180000 + abono 25000 (pagosExtra) = 205000 EFECTIVO; fondo 50000 → esperado 255000, diferencia 0', () => {
    const registros = [makeRegistro({ totalServicios: 180000 })];
    const gastos: never[] = [];
    const pagosExtra = [makePago(180000, 'EFECTIVO'), makePago(25000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, 255000, 50000, pagosExtra);

    expect(reporte.porMetodoPago).toEqual({ EFECTIVO: 205000, TARJETA: 0, TRANSFERENCIA: 0 });
    expect(reporte.montoEsperado).toBe(255000);
    expect(reporte.montoReal).toBe(255000);
    expect(reporte.diferencia).toBe(0);
  });

  it('should build the complete report with breakdown (owner decision: arqueo cash-only desde pagosExtra)', () => {
    const registros = [
      makeRegistro({
        id: 1,
        totalServicios: 150000,
        totalProductos: 60000,
        comisionCalculada: 56000,
        precioAjustado: true,
        valorOriginal: 160000,
        valorFinal: 150000, // descuento 10000
      }),
      makeRegistro({
        id: 2,
        totalServicios: 90000,
        totalProductos: 0,
        comisionCalculada: 40000,
      }),
      makeRegistro({
        id: 3,
        totalServicios: 0,
        totalProductos: 0,
        comisionCalculada: 0,
      }),
    ];
    const gastos = [
      makeGasto({ monto: 20000 }),
      makeGasto({ monto: 10000, metodoPago: 'TRANSFERENCIA' }),
    ];
    // La caja recibió: 120000 EFECTIVO + 90000 TARJETA (registro 1) y 80000 EFECTIVO (registro 2)
    const pagosExtra = [
      makePago(120000, 'EFECTIVO'),
      makePago(90000, 'TARJETA'),
      makePago(80000, 'EFECTIVO'),
    ];

    const reporte = calcularReporteCierre(registros, gastos, 170000, 0, pagosExtra);

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

  it('should exclude ANULADO registros from all totals (líneas informativas y cantidadMovimientos)', () => {
    const registros = [
      makeRegistro({
        id: 1,
        estado: EstadoRegistro.ANULADO,
        totalServicios: 999999,
      }),
      makeRegistro({
        id: 2,
        totalServicios: 50000,
      }),
    ];
    const gastos: never[] = [];
    const pagosExtra = [makePago(50000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, 50000, 0, pagosExtra);

    expect(reporte.totalServicios).toBe(50000);
    expect(reporte.porMetodoPago.EFECTIVO).toBe(50000);
    expect(reporte.montoEsperado).toBe(50000);
    expect(reporte.cantidadMovimientos).toBe(1);
  });

  it('should leave montoReal y diferencia null cuando no hay montoRealEfectivo (preview)', () => {
    const registros = [makeRegistro({ totalServicios: 100000 })];
    const gastos: never[] = [];
    const pagosExtra = [makePago(100000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, null, 0, pagosExtra);

    expect(reporte.montoEsperado).toBe(100000);
    expect(reporte.montoReal).toBeNull();
    expect(reporte.diferencia).toBeNull();
  });

  it('should include montoInicial in montoEsperado (el cajero cuenta el cajón completo con el fondo)', () => {
    const registros = [makeRegistro({ totalServicios: 10000 })];
    const gastos: never[] = [];
    const pagosExtra = [makePago(10000, 'EFECTIVO')];

    const reporte = calcularReporteCierre(registros, gastos, 60000, 50000, pagosExtra);

    // Fondo 50000 + ventas EFECTIVO 10000 = 60000 esperado en cajón
    expect(reporte.montoEsperado).toBe(60000);
    expect(reporte.diferencia).toBe(0);
  });

  it('should default pagosExtra a [] (fiado total sin pagos): esperado = fondo − gastos EFECTIVO', () => {
    const registros = [makeRegistro({ totalServicios: 100000, totalProductos: 0 })];
    const gastos = [makeGasto({ monto: 20000 })];
    // Sin pagosExtra: la venta fue fiada, el cajón solo tiene el fondo y sacó 20000 de gasto

    const reporte = calcularReporteCierre(registros, gastos, 30000, 50000);

    expect(reporte.porMetodoPago).toEqual({ EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 });
    expect(reporte.montoEsperado).toBe(30000);
    // Líneas informativas devengadas siguen mostrando la venta completa
    expect(reporte.ingresosBrutos).toBe(100000);
  });
});
