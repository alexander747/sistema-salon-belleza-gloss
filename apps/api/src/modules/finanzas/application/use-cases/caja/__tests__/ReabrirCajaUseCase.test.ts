import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation (patrón CerrarCajaUseCase.test.ts)
vi.mock('../../../../../../infrastructure/persistence/entities/CajaEntity.js', () => ({
  CajaEntity: class CajaEntity {},
}));

import { ReabrirCajaUseCase } from '../ReabrirCajaUseCase';
import { CajaNoAbiertaError, CajaYaAbiertaError } from '../../../../../../shared/errors';

const mockCajaRepo = {
  findBySalonYFecha: vi.fn(),
  reabrir: vi.fn(),
};

/** Caja de hoy ya cerrada (p. ej. cerrada para almorzar) con datos de cierre seteados. */
const cajaCerrada = {
  id: 5,
  salonId: 1,
  fechaCaja: '2026-08-16',
  montoInicial: 50000,
  estado: 'CERRADA',
  aperturaPorId: 9,
  aperturaEn: new Date(),
  cierrePorId: 2,
  cierreEn: new Date(),
  montoEsperado: 60000,
  montoRealEfectivo: 60000,
  diferencia: 0,
};

const cajaAbierta = { ...cajaCerrada, estado: 'ABIERTA', cierrePorId: null, cierreEn: null, montoEsperado: null, montoRealEfectivo: null, diferencia: null };

describe('ReabrirCajaUseCase', () => {
  let useCase: ReabrirCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ReabrirCajaUseCase(mockCajaRepo as never);
  });

  it('should reabrir la MISMA caja de hoy (id 5) limpiando los datos de cierre, sin crear fila nueva', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaCerrada);
    mockCajaRepo.reabrir.mockResolvedValue(true);

    const result = await useCase.execute({ salonId: 1 });

    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(1, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockCajaRepo.reabrir).toHaveBeenCalledWith(5);
    expect(result.id).toBe(5);
    expect(result.estado).toBe('ABIERTA');
    expect(result.montoEsperado).toBeNull();
    expect(result.montoRealEfectivo).toBeNull();
    expect(result.diferencia).toBeNull();
    expect(result.cierrePorId).toBeNull();
    expect(result.cierreEn).toBeNull();
  });

  it('should throw CajaYaAbiertaError cuando la caja de hoy ya está ABIERTA', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaAbierta);

    await expect(useCase.execute({ salonId: 1 })).rejects.toThrow(CajaYaAbiertaError);
    expect(mockCajaRepo.reabrir).not.toHaveBeenCalled();
  });

  it('should throw CajaNoAbiertaError cuando no existe caja para hoy', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(null);

    await expect(useCase.execute({ salonId: 1 })).rejects.toThrow(CajaNoAbiertaError);
    expect(mockCajaRepo.reabrir).not.toHaveBeenCalled();
  });

  it('should throw CajaYaAbiertaError cuando el update condicional no gana (race: otra request ya la reabrió)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(cajaCerrada);
    mockCajaRepo.reabrir.mockResolvedValue(false);

    await expect(useCase.execute({ salonId: 1 })).rejects.toThrow(CajaYaAbiertaError);
  });

  it('reabre la caja CERRADA de una fecha pasada cuando se pasa fechaCaja (historial)', async () => {
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ ...cajaCerrada, id: 16, fechaCaja: '2026-08-21' });
    mockCajaRepo.reabrir.mockResolvedValue(true);

    const result = await useCase.execute({ salonId: 1, fechaCaja: '2026-08-21' });

    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(1, '2026-08-21');
    expect(mockCajaRepo.reabrir).toHaveBeenCalledWith(16);
    expect(result.id).toBe(16);
    expect(result.estado).toBe('ABIERTA');
    expect(result.fechaCaja).toBe('2026-08-21');
  });
});
