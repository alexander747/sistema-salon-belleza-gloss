import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ComisionService } from '../ComisionService';

describe('ComisionService', () => {
  const service = new ComisionService();

  describe('calcularComision', () => {
    it('should calculate 60% of 100000 = 60000', () => {
      const result = service.calcularComision(100000, 60);
      expect(result).toBe(60000);
    });

    it('should calculate 50% of 25000 = 12500', () => {
      const result = service.calcularComision(25000, 50);
      expect(result).toBe(12500);
    });

    it('should return 0 when totalServicios is 0', () => {
      const result = service.calcularComision(0, 60);
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const result = service.calcularComision(33333, 33);
      expect(result).toBe(10999.89);
    });

    it('should return 0 when porcentajeComision is 0', () => {
      const result = service.calcularComision(100000, 0);
      expect(result).toBe(0);
    });

    // ── New tests: costo base insumos ────────────────────────

    it('should subtract totalCostoBaseInsumos before applying percentage (scenario 1)', () => {
      const result = service.calcularComision(100000, 60, 40000);
      expect(result).toBe(36000);  // (100000-40000)*0.6
    });

    it('should return legacy behavior when totalCostoBaseInsumos=0 (scenario 2)', () => {
      const result = service.calcularComision(100000, 60, 0);
      expect(result).toBe(60000);
    });

    it('should calculate (50000-20000)*50% = 15000 (scenario 3)', () => {
      const result = service.calcularComision(50000, 50, 20000);
      expect(result).toBe(15000);
    });

    it('should return 0 when insumos exceed totalServicios (scenario 4)', () => {
      const result = service.calcularComision(30000, 50, 35000);
      expect(result).toBe(0);
    });

    it('should return 0 when totalServicios is 0 with insumos (scenario 5)', () => {
      const result = service.calcularComision(0, 60, 0);
      expect(result).toBe(0);
    });

    it('should return 0 when porcentaje is 0 even with insumos (scenario 6)', () => {
      const result = service.calcularComision(100000, 0, 40000);
      expect(result).toBe(0);
    });
  });

  describe('calcularMontoPendiente', () => {
    it('should compute pendiente over the FINAL value actually charged: 90000 - 0 - 90000 = 0 (full payment of discounted total)', () => {
      const result = service.calcularMontoPendiente(90000, 0, 90000);
      expect(result).toBe(0);
    });

    it('should compute pendiente over the FINAL value actually charged: 90000 - 0 - 50000 = 40000 (partial payment of discounted total)', () => {
      const result = service.calcularMontoPendiente(90000, 0, 50000);
      expect(result).toBe(40000);
    });

    it('should exclude propina: valorFinal 80000 - propina 10000 - pagado 40000 = 30000', () => {
      // Same business semantics as the legacy formula (servicios + productos - pagado):
      // servicios + productos = 70000, propina = 10000 → 80000 - 10000 - 40000 = 30000
      const result = service.calcularMontoPendiente(80000, 10000, 40000);
      expect(result).toBe(30000);
    });

    it('should return 0 when pagado exceeds the final value', () => {
      const result = service.calcularMontoPendiente(50000, 0, 60000);
      expect(result).toBe(0);
    });
  });

  describe('calcularMontoTotal', () => {
    it('should add servicios + productos + propina', () => {
      const result = service.calcularMontoTotal(50000, 20000, 10000);
      expect(result).toBe(80000);
    });
  });

  describe('calcularIngresoSalon', () => {
    it('should add servicios + productos (propina excluded)', () => {
      const result = service.calcularIngresoSalon(50000, 20000);
      expect(result).toBe(70000);
    });
  });
});
