import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { CostoInsumoService } from '../CostoInsumoService';
import { ComisionService } from '../ComisionService';

describe('CostoInsumoService.calcularCostoLinea', () => {
  const service = new CostoInsumoService();

  it('should return the fixed catalog cost for a FIJO line', () => {
    const result = service.calcularCostoLinea({
      tipoCostoInsumo: 'FIJO',
      costoBaseInsumos: 25000,
    });
    expect(result).toBe(25000);
  });

  it('should default to 0 when a FIJO line has no cost', () => {
    const result = service.calcularCostoLinea({ tipoCostoInsumo: 'FIJO' });
    expect(result).toBe(0);
  });

  it('should derive the real per-gram cost: 95 grams × 1200 = 114000', () => {
    const result = service.calcularCostoLinea({
      tipoCostoInsumo: 'POR_GRAMO',
      gramosUsados: 95,
      precioPorGramo: 1200,
    });
    expect(result).toBe(114000);
  });

  it('should round the per-gram cost to 2 decimals (33.333 × 7 = 233.33)', () => {
    const result = service.calcularCostoLinea({
      tipoCostoInsumo: 'POR_GRAMO',
      gramosUsados: 33.333,
      precioPorGramo: 7,
    });
    expect(result).toBe(233.33);
  });

  it('should treat a missing tipoCostoInsumo as FIJO (legacy row)', () => {
    const result = service.calcularCostoLinea({ costoBaseInsumos: 5000 });
    expect(result).toBe(5000);
  });

  it('should ignore costoBaseInsumos on a POR_GRAMO line (anti-forgery)', () => {
    const result = service.calcularCostoLinea({
      tipoCostoInsumo: 'POR_GRAMO',
      gramosUsados: 95,
      precioPorGramo: 1200,
      costoBaseInsumos: 0,
    });
    expect(result).toBe(114000);
  });
});

describe('CostoInsumoService + ComisionService (real cost feeds the unchanged formula)', () => {
  const costoService = new CostoInsumoService();
  const comisionService = new ComisionService();

  it('should compute registro 182 commission: (450000 − 114000) × 60% = 201600', () => {
    const costo = costoService.calcularCostoLinea({
      tipoCostoInsumo: 'POR_GRAMO',
      gramosUsados: 95,
      precioPorGramo: 1200,
    });
    const comision = comisionService.calcularComision(450000, 60, costo);

    expect(costo).toBe(114000);
    expect(comision).toBe(201600);
  });

  it('should never produce a negative commission when insumos exceed the total', () => {
    const comision = comisionService.calcularComision(100000, 60, 120000);
    expect(comision).toBe(0);
  });
});
