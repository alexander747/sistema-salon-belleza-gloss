import { describe, it, expect } from 'vitest';
import {
  calcularDesgloseReparto,
  costoUnitarioLinea,
  lineasServicioCita,
  totalServiciosCita,
} from './reparto.js';

/**
 * Réplica de la fórmula del servidor (E2):
 *   servNeto = round(totalServicios × (1 − pctServ/100))
 *   pctServ  = (alcance ∈ {SERVICIOS, AMBOS}) ? % : 0
 *   comision = max(0, servNeto − insumos) × (porcentaje/100)
 *   (CreateRegistroUseCase + ComisionService)
 */
describe('calcularDesgloseReparto — servicios con % (E2)', () => {
  it('alcance SERVICIOS al 20%: aplica el % y reparte 60/40', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 550000,
      totalCostoInsumos: 24000,
      porcentajeDescuento: 20,
      descuentoAlcance: 'SERVICIOS',
      porcentajeComision: 60,
    });

    // 550000 × 0.8 = 440000
    expect(desglose.cobradoServicios).toBe(440000);
    expect(desglose.insumos).toBe(24000);
    expect(desglose.aRepartir).toBe(416000);
    expect(desglose.comisionEmpleada).toBe(249600);
    expect(desglose.quedaSalon).toBe(166400);
    expect(desglose.insumoSuperaCobrado).toBe(false);
  });

  it('alcance PRODUCTOS al 20%: los servicios NO se descuentan (base de comisión intacta)', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 550000,
      totalCostoInsumos: 24000,
      porcentajeDescuento: 20,
      descuentoAlcance: 'PRODUCTOS',
      porcentajeComision: 60,
    });

    expect(desglose.cobradoServicios).toBe(550000);
    expect(desglose.aRepartir).toBe(526000);
    expect(desglose.comisionEmpleada).toBe(315600);
    expect(desglose.quedaSalon).toBe(210400);
  });

  it('alcance AMBOS aplica el % a servicios (la comisión nunca toca productos)', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 100000,
      totalCostoInsumos: 20000,
      porcentajeDescuento: 10,
      descuentoAlcance: 'AMBOS',
      porcentajeComision: 50,
    });

    expect(desglose.cobradoServicios).toBe(90000);
    expect(desglose.aRepartir).toBe(70000);
    expect(desglose.comisionEmpleada).toBe(35000);
    expect(desglose.quedaSalon).toBe(35000);
  });

  it('sin descuento (0%) la base de servicios es el bruto', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 100000,
      totalCostoInsumos: 25000,
      porcentajeDescuento: 0,
      descuentoAlcance: 'AMBOS',
      porcentajeComision: 0,
    });

    expect(desglose.cobradoServicios).toBe(100000);
    expect(desglose.aRepartir).toBe(75000);
    expect(desglose.comisionEmpleada).toBe(0);
    expect(desglose.quedaSalon).toBe(75000);
  });
});

describe('calcularDesgloseReparto — insumo mayor al cobrado', () => {
  it('clampea la comisión en 0 y nunca devuelve negativos', () => {
    const desglose = calcularDesgloseReparto({
      totalServicios: 20000,
      totalCostoInsumos: 24000,
      porcentajeDescuento: 50,
      descuentoAlcance: 'SERVICIOS',
      porcentajeComision: 60,
    });

    // 20000 × 0.5 = 10000 < 24000 de insumo
    expect(desglose.cobradoServicios).toBe(10000);
    expect(desglose.aRepartir).toBe(0);
    expect(desglose.comisionEmpleada).toBe(0);
    expect(desglose.quedaSalon).toBe(0);
    expect(desglose.insumoSuperaCobrado).toBe(true);
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
