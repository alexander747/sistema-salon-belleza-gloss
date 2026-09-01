import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResumenMensualUseCase } from '../ResumenMensualUseCase';

describe('ResumenMensualUseCase', () => {
  let useCase: ResumenMensualUseCase;
  let mockRegistroRepo: { sumPagosPorMes: ReturnType<typeof vi.fn> };
  let mockGastoRepo: { findBySalon: ReturnType<typeof vi.fn> };
  let mockLiquidacionRepo: { findBySalon: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = { sumPagosPorMes: vi.fn() };
    mockGastoRepo = { findBySalon: vi.fn() };
    mockLiquidacionRepo = { findBySalon: vi.fn() };
    useCase = new ResumenMensualUseCase(
      mockRegistroRepo as never,
      mockGastoRepo as never,
      mockLiquidacionRepo as never,
    );
    mockRegistroRepo.sumPagosPorMes.mockResolvedValue([]);
    mockGastoRepo.findBySalon.mockResolvedValue([]);
    mockLiquidacionRepo.findBySalon.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rango por defecto (6 meses) y meses vacíos', () => {
    beforeEach(() => {
      // Colombia: 01/09/2026 10:00 → mes actual 2026-09, rango 2026-04..2026-09
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-01T15:00:00.000Z'));
    });

    it('incluye los meses vacíos con 0, ordena ascendente y calcula ganancia (escenario spec: agosto cobró 2.295.000)', async () => {
      mockRegistroRepo.sumPagosPorMes.mockResolvedValue([{ mes: '2026-08', total: 2295000 }]);
      mockGastoRepo.findBySalon.mockResolvedValue([
        { fecha: new Date('2026-08-10T00:00:00Z'), monto: 200000 },
        { fecha: new Date('2026-08-11T00:00:00Z'), monto: 150000 },
      ]);
      mockLiquidacionRepo.findBySalon.mockResolvedValue([
        { creadoEn: new Date('2026-08-15T12:00:00Z'), totalPagado: 400000 },
      ]);

      const result = await useCase.execute({ salonId: 1 });

      expect(result).toHaveLength(6);
      expect(result.map((r) => r.mes)).toEqual([
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
      ]);

      const agosto = result.find((r) => r.mes === '2026-08')!;
      expect(agosto.ingresos).toBe(2295000);
      expect(agosto.gastos).toBe(350000);
      expect(agosto.nomina).toBe(400000);
      expect(agosto.ganancia).toBe(1545000); // 2295000 − 350000 − 400000

      // Meses vacíos → 0 (no se omiten)
      for (const r of result) {
        if (r.mes !== '2026-08') {
          expect(r.ingresos).toBe(0);
          expect(r.gastos).toBe(0);
          expect(r.nomina).toBe(0);
          expect(r.ganancia).toBe(0);
        }
      }

      // El cobrado se consulta con límites Colombia del rango completo
      expect(mockRegistroRepo.sumPagosPorMes).toHaveBeenCalledWith(
        1,
        new Date('2026-04-01T05:00:00.000Z'),
        new Date('2026-10-01T05:00:00.000Z'),
      );
    });

    it('sin datos en el rango devuelve 6 meses en cero', async () => {
      const result = await useCase.execute({ salonId: 1 });

      expect(result).toHaveLength(6);
      for (const r of result) {
        expect(r.ingresos).toBe(0);
        expect(r.gastos).toBe(0);
        expect(r.nomina).toBe(0);
        expect(r.ganancia).toBe(0);
      }
    });
  });

  describe('meses parametrizado y filtrado por rango', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-01T15:00:00.000Z'));
    });

    it('meses=3 respeta el rango y excluye datos fuera de él (gastos/nómina)', async () => {
      mockRegistroRepo.sumPagosPorMes.mockResolvedValue([
        { mes: '2026-07', total: 1000000 },
        { mes: '2026-09', total: 500000 },
      ]);
      mockGastoRepo.findBySalon.mockResolvedValue([
        { fecha: new Date('2026-07-05T00:00:00Z'), monto: 100000 },
        { fecha: new Date('2026-09-05T00:00:00Z'), monto: 50000 },
        { fecha: new Date('2026-06-05T00:00:00Z'), monto: 999999 }, // fuera del rango
      ]);
      mockLiquidacionRepo.findBySalon.mockResolvedValue([
        { creadoEn: new Date('2026-07-10T12:00:00Z'), totalPagado: 200000 },
        { creadoEn: new Date('2026-08-10T12:00:00Z'), totalPagado: 300000 },
        { creadoEn: new Date('2026-05-10T12:00:00Z'), totalPagado: 999999 }, // fuera del rango
      ]);

      const result = await useCase.execute({ salonId: 1, meses: 3 });

      expect(result.map((r) => r.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
      const julio = result.find((r) => r.mes === '2026-07')!;
      const agosto = result.find((r) => r.mes === '2026-08')!;
      const septiembre = result.find((r) => r.mes === '2026-09')!;

      expect(julio).toEqual({ mes: '2026-07', ingresos: 1000000, gastos: 100000, nomina: 200000, ganancia: 700000 });
      // Mes con nómina pero sin ingresos ni gastos → ganancia negativa
      expect(agosto).toEqual({ mes: '2026-08', ingresos: 0, gastos: 0, nomina: 300000, ganancia: -300000 });
      expect(septiembre).toEqual({ mes: '2026-09', ingresos: 500000, gastos: 50000, nomina: 0, ganancia: 450000 });

      expect(mockRegistroRepo.sumPagosPorMes).toHaveBeenCalledWith(
        1,
        new Date('2026-07-01T05:00:00.000Z'),
        new Date('2026-10-01T05:00:00.000Z'),
      );
    });
  });

  describe('zona horaria Colombia (UTC-5)', () => {
    it('antes de medianoche Colombia el mes actual sigue siendo el anterior (2026-08)', async () => {
      // 01/09/2026 03:00 UTC = 31/08/2026 22:00 Colombia → mes actual 2026-08
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-01T03:00:00.000Z'));

      mockRegistroRepo.sumPagosPorMes.mockResolvedValue([{ mes: '2026-08', total: 2295000 }]);

      const result = await useCase.execute({ salonId: 1 });

      expect(result).toHaveLength(6);
      expect(result[0].mes).toBe('2026-03');
      expect(result[5].mes).toBe('2026-08');
      expect(result[5].ingresos).toBe(2295000);

      expect(mockRegistroRepo.sumPagosPorMes).toHaveBeenCalledWith(
        1,
        new Date('2026-03-01T05:00:00.000Z'),
        new Date('2026-09-01T05:00:00.000Z'),
      );
    });
  });
});
