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
  });

  describe('calcularMontoPendiente', () => {
    it('should calculate (50000+20000) - 40000 = 30000 (propina excluded)', () => {
      const result = service.calcularMontoPendiente(50000, 20000, 40000);
      expect(result).toBe(30000);
    });

    it('should return 0 when pagado exceeds total', () => {
      const result = service.calcularMontoPendiente(30000, 10000, 50000);
      expect(result).toBe(0);
    });

    it('should return 0 when fully paid', () => {
      const result = service.calcularMontoPendiente(50000, 20000, 70000);
      expect(result).toBe(0);
    });

    it('should not include propina in the calculation', () => {
      // Even if there's a propina (10000), montoPendiente only considers
      // totalServicios + totalProductos - totalPagado
      const result = service.calcularMontoPendiente(50000, 20000, 40000);
      expect(result).toBe(30000);
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
