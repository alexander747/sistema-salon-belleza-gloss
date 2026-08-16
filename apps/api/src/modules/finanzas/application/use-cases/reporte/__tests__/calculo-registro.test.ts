import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { calcularContribucionesRegistro } from '../calculo-registro';

describe('calcularContribucionesRegistro', () => {
  it('aplica la proporción del descuento a servicios y productos (10% descuento)', () => {
    const result = calcularContribucionesRegistro({
      totalServicios: 300000,
      totalProductos: 50000,
      propina: 15000,
      montoTotal: 365000, // 300000 + 50000 + 15000
      valorFinal: 330000, // 315000 + 15000 (descuento 10% sobre serv+prod)
    });

    expect(result).toEqual({ servicios: 270000, productos: 45000 });
  });

  it('sin descuento las contribuciones son iguales a los brutos', () => {
    const result = calcularContribucionesRegistro({
      totalServicios: 100000,
      totalProductos: 30000,
      propina: 20000,
      montoTotal: 150000,
      valorFinal: 150000, // sin descuento
    });

    expect(result).toEqual({ servicios: 100000, productos: 30000 });
  });

  it('descuento 100% deja servicios y productos en cero (solo propina)', () => {
    const result = calcularContribucionesRegistro({
      totalServicios: 80000,
      totalProductos: 20000,
      propina: 10000,
      montoTotal: 110000,
      valorFinal: 10000, // valorFinal == propina → nada por servicios/productos
    });

    expect(result).toEqual({ servicios: 0, productos: 0 });
  });

  it('registro solo de propina (base bruta cero) mantiene contribuciones en cero', () => {
    const result = calcularContribucionesRegistro({
      totalServicios: 0,
      totalProductos: 0,
      propina: 15000,
      montoTotal: 15000,
    });

    expect(result).toEqual({ servicios: 0, productos: 0 });
  });

  it('redondea cada contribución (Math.round) como el resumen diario', () => {
    const result = calcularContribucionesRegistro({
      totalServicios: 100001,
      totalProductos: 9999,
      propina: 0,
      montoTotal: 110000,
      valorFinal: 99000, // proporcion 0.9
    });

    // 100001 * 0.9 = 90000.9 → 90001 ; 9999 * 0.9 = 8999.1 → 8999
    expect(result).toEqual({ servicios: 90001, productos: 8999 });
  });
});
