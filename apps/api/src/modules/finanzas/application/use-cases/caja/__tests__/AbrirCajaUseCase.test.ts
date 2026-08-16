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

import { AbrirCajaUseCase } from '../AbrirCajaUseCase';
import { CajaYaAbiertaError, CajaYaCerradaError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  findBySalonYFecha: vi.fn(),
  create: vi.fn(),
};

describe('AbrirCajaUseCase', () => {
  let useCase: AbrirCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AbrirCajaUseCase(mockCajaRepo as never);
  });

  it('should create caja ABIERTA with fechaCaja de hoy y aperturaPorId', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(null);
    mockCajaRepo.create.mockResolvedValue({
      id: 7,
      salonId: 3,
      fechaCaja: '2026-08-16',
      montoInicial: 50000,
      estado: 'ABIERTA',
      aperturaPorId: 9,
      aperturaEn: new Date('2026-08-16T05:00:00Z'),
      cierrePorId: null,
      cierreEn: null,
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
    });

    const result = await useCase.execute({ salonId: 3, montoInicial: 50000, aperturaPorId: 9 });

    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(3, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockCajaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 3,
        montoInicial: 50000,
        estado: 'ABIERTA',
        aperturaPorId: 9,
      }),
    );
    expect(result).toMatchObject({
      id: 7,
      salonId: 3,
      montoInicial: 50000,
      estado: 'ABIERTA',
      aperturaPorId: 9,
    });
  });

  it('should throw CajaYaAbiertaError cuando ya existe una caja ABIERTA', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ id: 1, estado: 'ABIERTA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaAbiertaError);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError cuando ya existe una caja CERRADA (no reapertura)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ id: 1, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
  });

  it('should re-query y lanzar 409 correcto cuando create falla con ER_DUP_ENTRY (race apertura)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce(null);
    const dupError = new Error('Duplicate entry');
    (dupError as { code?: string }).code = 'ER_DUP_ENTRY';
    mockCajaRepo.create.mockRejectedValueOnce(dupError);
    // re-query: la otra request ganó y creó una ABIERTA
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce({ id: 2, estado: 'ABIERTA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaAbiertaError);
    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledTimes(2);
  });

  it('should re-query y lanzar CajaYaCerradaError cuando el duplicado es CERRADA', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce(null);
    const dupError = new Error('Duplicate entry');
    (dupError as { code?: string }).code = 'ER_DUP_ENTRY';
    mockCajaRepo.create.mockRejectedValueOnce(dupError);
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce({ id: 2, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaCerradaError);
  });
});
