import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation (patrón CreateSalonUseCase.test.ts)
vi.mock('../../../../../../infrastructure/persistence/entities/SalonEntity.js', () => ({
  SalonEntity: class SalonEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/CajaEntity.js', () => ({
  CajaEntity: class CajaEntity {},
}));

import { SaldoInicialCajaUseCase } from '../SaldoInicialCajaUseCase';
import { calcularPosicionCaja } from '../calcularPosicionCaja';
import { NotFoundError, ValidationError } from '../../../../../../shared/errors';

const mockSalonRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};

const mockCajaRepo = {
  listBySalonPaginated: vi.fn(),
};

describe('calcularPosicionCaja', () => {
  it('suma el saldo inicial más el efecto NETO de cada caja cerrada (montoEsperado − montoInicial)', () => {
    expect(
      calcularPosicionCaja(100000, [
        { montoInicial: 50000, montoEsperado: 170000 }, // día que acumuló +120000
        { montoInicial: 50000, montoEsperado: 30000 }, // día con egresos: −20000
      ]),
    ).toBe(200000);
  });

  it('sin cajas cerradas → devuelve solo el saldo inicial', () => {
    expect(calcularPosicionCaja(250000, [])).toBe(250000);
  });

  it('tolera nulls (saldo/cajas legacy) sin romper el cálculo', () => {
    expect(calcularPosicionCaja(null, [{ montoInicial: null, montoEsperado: null }])).toBe(0);
  });
});

describe('SaldoInicialCajaUseCase', () => {
  let useCase: SaldoInicialCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({ data: [], total: 0 });
    useCase = new SaldoInicialCajaUseCase(mockSalonRepo as never, mockCajaRepo as never);
  });

  it('obtener: devuelve el saldo persistido y la posición de caja acumulada', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: 100000 });
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [{ montoInicial: 50000, montoEsperado: 90000 }],
      total: 1,
    });

    const result = await useCase.obtener(1);

    expect(result).toEqual({ saldoInicialCaja: 100000, posicionCaja: 140000 });
    expect(mockSalonRepo.findById).toHaveBeenCalledWith(1);
    // Solo las cajas CERRADAS aportan efecto (las ABIERTAS no tienen arqueo persistido).
    expect(mockCajaRepo.listBySalonPaginated).toHaveBeenCalledWith(1, 1, 0, 'CERRADA');
  });

  it('obtener: saldo null (fila legacy) → 0, sin romper', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: null });

    const result = await useCase.obtener(1);

    expect(result.saldoInicialCaja).toBe(0);
  });

  it('obtener: salón inexistente → NotFoundError', async () => {
    mockSalonRepo.findById.mockResolvedValue(null);

    await expect(useCase.obtener(9)).rejects.toThrow(NotFoundError);
  });

  it('actualizar: persiste en el salón y devuelve la posición recalculada', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: 0 });
    mockSalonRepo.update.mockResolvedValue({ id: 1, saldoInicialCaja: 500000 });
    mockCajaRepo.listBySalonPaginated.mockResolvedValue({
      data: [{ montoInicial: 50000, montoEsperado: 80000 }],
      total: 1,
    });

    const result = await useCase.actualizar(1, 500000);

    expect(mockSalonRepo.update).toHaveBeenCalledWith(1, { saldoInicialCaja: 500000 });
    expect(result).toEqual({ saldoInicialCaja: 500000, posicionCaja: 530000 });
  });

  it('actualizar: valor negativo → ValidationError y NO persiste', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: 0 });

    await expect(useCase.actualizar(1, -1)).rejects.toThrow(ValidationError);
    expect(mockSalonRepo.update).not.toHaveBeenCalled();
  });

  it('actualizar: valor no finito (NaN) → ValidationError y NO persiste', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: 0 });

    await expect(useCase.actualizar(1, Number.NaN)).rejects.toThrow(ValidationError);
    expect(mockSalonRepo.update).not.toHaveBeenCalled();
  });

  it('actualizar: salón inexistente → NotFoundError y NO persiste', async () => {
    mockSalonRepo.findById.mockResolvedValue(null);

    await expect(useCase.actualizar(9, 100)).rejects.toThrow(NotFoundError);
    expect(mockSalonRepo.update).not.toHaveBeenCalled();
  });

  it('NO es ingreso: el DTO expone solo saldoInicialCaja y posicionCaja (sin campos de P&L)', async () => {
    mockSalonRepo.findById.mockResolvedValue({ id: 1, saldoInicialCaja: 0 });
    mockSalonRepo.update.mockResolvedValue({ id: 1, saldoInicialCaja: 100 });

    const result = await useCase.actualizar(1, 100);

    expect(Object.keys(result).sort()).toEqual(['posicionCaja', 'saldoInicialCaja']);
  });
});
