import { describe, it, expect } from 'vitest';
import {
  calcularDesgloseReparto,
  costoUnitarioLinea,
  lineasServicioCita,
  totalServiciosCita,
} from './reparto.js';

/**
 * Réplica de la fórmula del servidor:
 *   totalServiciosAjustado = round(totalServicios × (valorFinal − propina)/(montoTotal − propina))
 *   comision = max(0, totalServiciosAjustado − insumos) × (porcentaje/100)
 *   (CreateRegistroUseCase.ts:162-174 + ComisionService.ts:11-18)
 */
describe('calcularDesgloseReparto — caso canónico del dueño', () => {
  it('ajuste 550.000 → 300.000 con 30 g ($800/g): 24.000 de insumo y reparto 60/40', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 550000,
      totalProductos: 0,
      propina: 0,
      totalCostoInsumos: 24000,
      valorFinal: 300000,
      porcentajeComision: 60,
    });

    expect(desglose.cobradoServicios).toBe(300000);
    expect(desglose.insumos).toBe(24000);
    expect(desglose.aRepartir).toBe(276000);
    expect(desglose.comisionEmpleada).toBe(165600);
    expect(desglose.quedaSalon).toBe(110400);
    expect(desglose.insumoSuperaCobrado).toBe(false);
  });

  it('caso canónico con cantidad ×2 duplica el insumo y el reparto', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 550000 * 2,
      totalProductos: 0,
      propina: 0,
      totalCostoInsumos: 24000 * 2,
      valorFinal: 300000 * 2,
      porcentajeComision: 60,
    });

    expect(desglose.cobradoServicios).toBe(600000);
    expect(desglose.aRepartir).toBe(552000);
    expect(desglose.comisionEmpleada).toBe(331200);
    expect(desglose.quedaSalon).toBe(220800);
  });
});

describe('calcularDesgloseReparto — insumo mayor al cobrado', () => {
  it('clampea la comisión en 0 y nunca devuelve negativos', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 550000,
      totalProductos: 0,
      propina: 0,
      totalCostoInsumos: 24000,
      valorFinal: 20000,
      porcentajeComision: 60,
    });

    expect(desglose.cobradoServicios).toBe(20000);
    expect(desglose.aRepartir).toBe(0);
    expect(desglose.comisionEmpleada).toBe(0);
    expect(desglose.quedaSalon).toBe(0);
    expect(desglose.insumoSuperaCobrado).toBe(true);
  });

  it('sin comisión configurada (0%) el salón se queda con todo lo repartible', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 100000,
      totalProductos: 0,
      propina: 0,
      totalCostoInsumos: 25000,
      valorFinal: 100000,
      porcentajeComision: 0,
    });

    expect(desglose.aRepartir).toBe(75000);
    expect(desglose.comisionEmpleada).toBe(0);
    expect(desglose.quedaSalon).toBe(75000);
  });
});

describe('calcularDesgloseReparto — productos y propina (prorrateo del servidor)', () => {
  it('prorratea la parte de servicios del total cobrado igual que el backend', () => {
    // montoTotal = 150.000; baseReal = 120.000 − 10.000 = 110.000
    // proporcion = 110.000 / 150.000 = 0,7333…; cobradoServicios = round(100.000 × 0,7333) = 73.333
    const desglose = calcularDesgloseReparto({
      totalServicios: 100000,
      totalProductos: 50000,
      propina: 10000,
      totalCostoInsumos: 20000,
      valorFinal: 120000,
      porcentajeComision: 50,
    });

    expect(desglose.cobradoServicios).toBe(73333);
    expect(desglose.aRepartir).toBe(53333);
    expect(desglose.comisionEmpleada).toBe(26666.5);
    expect(desglose.quedaSalon).toBe(26666.5);
  });
});

describe('costoUnitarioLinea — espejo de CostoInsumoService', () => {
  it('POR_GRAMO usa gramos × precioPorGramo (ignora el costo del cliente)', () => {
    expect(
      costoUnitarioLinea({
        tipoCostoInsumo: 'POR_GRAMO',
        gramosUsados: 95,
        precioPorGramo: 1200,
        costoBaseInsumos: 0,
      }),
    ).toBe(114000);
  });

  it('POR_GRAMO redondea a 2 decimales como el servidor', () => {
    expect(
      costoUnitarioLinea({
        tipoCostoInsumo: 'POR_GRAMO',
        gramosUsados: 33.333,
        precioPorGramo: 0.1,
      }),
    ).toBe(3.33);
  });

  it('FIJO conserva el costoBaseInsumos y los gramos no lo alteran', () => {
    expect(
      costoUnitarioLinea({
        tipoCostoInsumo: 'FIJO',
        gramosUsados: 50,
        costoBaseInsumos: 25000,
      }),
    ).toBe(25000);
  });

  it('sin datos devuelve 0', () => {
    expect(costoUnitarioLinea({})).toBe(0);
  });
});

/**
 * Fuente única del total de servicios de una cita (display + payload).
 * Antes del PR6 el display omitía `× cantidad` y mostraba la MITAD de lo
 * que el servidor persistía para `cantidad > 1`.
 */
describe('lineasServicioCita / totalServiciosCita — total del completar (PR6)', () => {
  it('expande cantidad y totaliza Σ(cantidad × precio)', () => {
    const lineas = lineasServicioCita(
      [
        { id: 1, precio: 30000, cantidad: 2 },
        { id: 2, precio: 10000, cantidad: 1 },
      ],
      {},
    );

    expect(lineas).toEqual([
      { id: 1, precio: 30000, cantidad: 2 },
      { id: 2, precio: 10000, cantidad: 1 },
    ]);
    expect(totalServiciosCita(lineas)).toBe(70000);
  });

  it('usa el precio override del formulario y defaultea cantidad a 1 (legacy)', () => {
    const lineas = lineasServicioCita(
      [
        { id: 1, precio: 30000 },
        { id: 2, precio: 10000 },
      ],
      { 1: 45000 },
    );

    expect(lineas).toEqual([
      { id: 1, precio: 45000, cantidad: 1 },
      { id: 2, precio: 10000, cantidad: 1 },
    ]);
    expect(totalServiciosCita(lineas)).toBe(55000);
  });

  it('sin servicios totaliza 0', () => {
    expect(totalServiciosCita(lineasServicioCita([], {}))).toBe(0);
  });
});
