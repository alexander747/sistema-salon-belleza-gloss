import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CierreTurnoUseCase } from '../CierreTurnoUseCase';
import { EstadoRegistro } from '../../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

interface MockPago {
  monto: number;
}

interface MockRegistro {
  estado: EstadoRegistro;
  totalProductos: number;
  comisionCalculada: number;
  propina: number;
  montoTotal: number;
  pagos?: MockPago[];
}

const buildRegistro = (overrides: Partial<MockRegistro> = {}): MockRegistro => ({
  estado: EstadoRegistro.ACTIVO,
  totalProductos: 0,
  comisionCalculada: 0,
  propina: 0,
  montoTotal: 0,
  pagos: [],
  ...overrides,
});

describe('CierreTurnoUseCase', () => {
  let useCase: CierreTurnoUseCase;
  let mockRegistroRepo: { search: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRegistroRepo = { search: vi.fn() };
    useCase = new CierreTurnoUseCase(mockRegistroRepo as never);
    mockRegistroRepo.search.mockResolvedValue([]);
  });

  it('totalAEntregar usa lo cobrado (Σ pagos), no el monto total — pago parcial/fiado', async () => {
    // Registro de 100000 con solo 60000 cobrados (40000 fiado)
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        comisionCalculada: 20000,
        propina: 0,
        montoTotal: 100000,
        pagos: [{ monto: 60000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      usuarioId: 4,
      fecha: new Date('2026-05-15'),
    });

    // 60000 cobrado − 20000 comisión − 0 propina = 40000 a entregar
    expect(result.totalAEntregar).toBe(40000);
    expect(result.totalACobrar).toBe(20000);
  });

  it('pago completo: totalAEntregar = Σ pagos − comisión − propina coincide con el fixture', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        comisionCalculada: 20000,
        propina: 5000,
        montoTotal: 100000,
        pagos: [{ monto: 100000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      usuarioId: 4,
      fecha: new Date('2026-05-15'),
    });

    expect(result.totalAEntregar).toBe(75000);
  });

  it('suma los pagos de varios registros y excluye los ANULADO', async () => {
    mockRegistroRepo.search.mockResolvedValue([
      buildRegistro({
        estado: EstadoRegistro.ANULADO,
        comisionCalculada: 5000,
        montoTotal: 90000,
        pagos: [{ monto: 90000 }],
      }),
      buildRegistro({
        comisionCalculada: 10000,
        propina: 2000,
        montoTotal: 50000,
        pagos: [{ monto: 30000 }],
      }),
      buildRegistro({
        comisionCalculada: 15000,
        propina: 1000,
        montoTotal: 60000,
        pagos: [{ monto: 60000 }],
      }),
    ]);

    const result = await useCase.execute({
      salonId: 1,
      usuarioId: 4,
      fecha: new Date('2026-05-15'),
    });

    // 30000 + 60000 cobrado − (10000+15000) comisión − (2000+1000) propina
    expect(result.totalAEntregar).toBe(62000);
    expect(result.comisionGanada).toBe(25000);
    expect(result.propinasRecibidas).toBe(3000);
    expect(result.serviciosRealizados).toBe(2);
    // El pago del ANULADO no entra al total a entregar
    expect(result.productosVendidos).toBe(0);
  });
});
