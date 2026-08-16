import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation (patrón CreateRegistroUseCase.test.ts)
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroServicioEntity.js', () => ({
  RegistroServicioEntity: class RegistroServicioEntity {},
  EstadoRegistro: { ACTIVO: 'ACTIVO', ANULADO: 'ANULADO' },
}));
vi.mock('../../../../../../infrastructure/persistence/entities/GastoEntity.js', () => ({
  GastoEntity: class GastoEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/CajaEntity.js', () => ({
  CajaEntity: class CajaEntity {},
}));
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

import { ObtenerCajaActualUseCase } from '../ObtenerCajaActualUseCase';
import { CajaNoAbiertaError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

describe('ObtenerCajaActualUseCase', () => {
  let useCase: ObtenerCajaActualUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ObtenerCajaActualUseCase(mockCajaRepo as never);
  });

  it('should devolver la caja ABIERTA actual', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({
      id: 5,
      salonId: 1,
      fechaCaja: '2026-08-16',
      montoInicial: 50000,
      estado: 'ABIERTA',
      aperturaPorId: 9,
      aperturaEn: new Date(),
      cierrePorId: null,
      cierreEn: null,
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
    });

    const result = await useCase.execute({ salonId: 1 });

    expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(result).toMatchObject({ id: 5, salonId: 1, estado: 'ABIERTA' });
  });

  it('should lanzar CajaNoAbiertaError cuando no hay caja abierta', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    await expect(useCase.execute({ salonId: 1 })).rejects.toThrow(CajaNoAbiertaError);
  });
});
