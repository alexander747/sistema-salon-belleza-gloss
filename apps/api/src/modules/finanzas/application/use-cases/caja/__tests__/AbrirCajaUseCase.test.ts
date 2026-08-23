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
import { getColombiaDateString } from '../../../../../../shared/colombia-date';

const MSG_ABIERTA_PENDIENTE =
  'Ya existe una caja abierta — cerrá la caja pendiente antes de abrir una nueva';

const mockCajaRepo = {
  findAbiertaBySalon: vi.fn(),
  findBySalonYFecha: vi.fn(),
  create: vi.fn(),
};

describe('AbrirCajaUseCase', () => {
  let useCase: AbrirCajaUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AbrirCajaUseCase(mockCajaRepo as never);
  });

  it('should create caja ABIERTA con fechaCaja de hoy y aperturaPorId (sin abiertas de ningún día)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
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

    expect(mockCajaRepo.findAbiertaBySalon).toHaveBeenCalledWith(3);
    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(3, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockCajaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 3,
        fechaCaja: getColombiaDateString(),
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

  it('should usar fechaCaja explícita pasada para el día, el create y el resultado (backfill 16/08)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
    mockCajaRepo.findBySalonYFecha.mockResolvedValue(null);
    mockCajaRepo.create.mockResolvedValue({
      id: 8,
      salonId: 3,
      fechaCaja: '2026-08-16',
      montoInicial: 50000,
      estado: 'ABIERTA',
      aperturaPorId: null,
      aperturaEn: new Date('2026-08-16T13:00:00Z'),
      cierrePorId: null,
      cierreEn: null,
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
    });

    const result = await useCase.execute({ salonId: 3, montoInicial: 50000, fechaCaja: '2026-08-16' });

    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(3, '2026-08-16');
    expect(mockCajaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: 3, fechaCaja: '2026-08-16' }),
    );
    expect(result).toMatchObject({ id: 8, salonId: 3, fechaCaja: '2026-08-16', estado: 'ABIERTA' });
  });

  it('should lanzar CajaYaAbiertaError con fechaCaja pasada cuando hay CUALQUIER caja ABIERTA (regla any-open)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue({
      id: 9,
      salonId: 3,
      fechaCaja: '2026-08-17',
      estado: 'ABIERTA',
    });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000, fechaCaja: '2026-08-16' }))
      .rejects.toThrow(MSG_ABIERTA_PENDIENTE);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
    expect(mockCajaRepo.findBySalonYFecha).not.toHaveBeenCalled();
  });

  it('should lanzar CajaYaCerradaError consultando la fechaCaja pasada (día ya cerrado 16/08)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ id: 1, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000, fechaCaja: '2026-08-16' }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenCalledWith(3, '2026-08-16');
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
  });

  it('should usar la fechaCaja pasada en el backstop ER_DUP_ENTRY (re-query con 16/08)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce(null);
    const dupError = new Error('Duplicate entry');
    (dupError as { code?: string }).code = 'ER_DUP_ENTRY';
    mockCajaRepo.create.mockRejectedValueOnce(dupError);
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce({ id: 2, estado: 'ABIERTA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000, fechaCaja: '2026-08-16' }))
      .rejects.toThrow(CajaYaAbiertaError);
    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenNthCalledWith(1, 3, '2026-08-16');
    expect(mockCajaRepo.findBySalonYFecha).toHaveBeenNthCalledWith(2, 3, '2026-08-16');
  });

  it('should throw CajaYaAbiertaError con mensaje nuevo cuando existe una huérfana ABIERTA de un día anterior', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue({
      id: 9,
      salonId: 3,
      fechaCaja: '2026-08-16',
      estado: 'ABIERTA',
    });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(MSG_ABIERTA_PENDIENTE);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
    // No llega al chequeo de día: la huérfana ya bloquea
    expect(mockCajaRepo.findBySalonYFecha).not.toHaveBeenCalled();
  });

  it('should throw CajaYaAbiertaError cuando la caja ABIERTA es de hoy', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue({
      id: 1,
      salonId: 3,
      fechaCaja: '2026-08-20',
      estado: 'ABIERTA',
    });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaAbiertaError);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
  });

  it('should throw CajaYaCerradaError cuando ya existe una caja CERRADA (no reapertura)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
    mockCajaRepo.findBySalonYFecha.mockResolvedValue({ id: 1, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaCerradaError);
    expect(mockCajaRepo.create).not.toHaveBeenCalled();
  });

  it('should re-query y lanzar 409 correcto cuando create falla con ER_DUP_ENTRY (race apertura)', async () => {
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
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
    mockCajaRepo.findAbiertaBySalon.mockResolvedValue(null);
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce(null);
    const dupError = new Error('Duplicate entry');
    (dupError as { code?: string }).code = 'ER_DUP_ENTRY';
    mockCajaRepo.create.mockRejectedValueOnce(dupError);
    mockCajaRepo.findBySalonYFecha.mockResolvedValueOnce({ id: 2, estado: 'CERRADA' });

    await expect(useCase.execute({ salonId: 3, montoInicial: 50000 }))
      .rejects.toThrow(CajaYaCerradaError);
  });
});
