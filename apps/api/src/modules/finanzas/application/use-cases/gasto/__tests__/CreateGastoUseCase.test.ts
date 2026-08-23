import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation.
vi.mock('../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

import { CreateGastoUseCase } from '../CreateGastoUseCase';
import type { MetodoPago } from '../../../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import { getColombiaDateString } from '../../../../../../shared/colombia-date';

// ── Mocks ──────────────────────────────────────────────────────
const mockGastoRepo = {
  create: vi.fn(),
};
const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

describe('CreateGastoUseCase', () => {
  let useCase: CreateGastoUseCase;

  const validInput = {
    salonId: 1,
    descripcion: 'Compra de insumos',
    monto: 30000,
    metodoPago: 'EFECTIVO' as MetodoPago,
    esGastoFijo: false,
    reportadoPorId: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateGastoUseCase(mockGastoRepo as never, mockCajaRepo as never);
  });

  it('should associate cajaId from the open caja', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA' });
    mockGastoRepo.create.mockResolvedValue({ id: 1, cajaId: 5 });

    const result = await useCase.execute(validInput);

    expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(
      1,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(mockGastoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 1,
        descripcion: 'Compra de insumos',
        monto: 30000,
        metodoPago: 'EFECTIVO',
        esGastoFijo: false,
        reportadoPorId: 2,
        cajaId: 5,
      }),
    );
    expect(result.cajaId).toBe(5);
  });

  it('should create the gasto with cajaId null when no caja is open (NOT gated)', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);
    mockGastoRepo.create.mockResolvedValue({ id: 1, cajaId: null });

    const result = await useCase.execute(validInput);

    expect(mockGastoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cajaId: null }),
    );
    expect(result.cajaId).toBeNull();
  });

  describe('fecha (backfill)', () => {
    it('should honrar input.fecha: persistirla y ligar la caja de ESA fecha', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 5, salonId: 1, estado: 'ABIERTA', fechaCaja: '2026-08-16' });
      mockGastoRepo.create.mockResolvedValue({ id: 1, cajaId: 5, fecha: new Date('2026-08-16T00:00:00.000Z') });

      await useCase.execute({ ...validInput, fecha: '2026-08-16' });

      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, '2026-08-16');
      expect(mockGastoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 5,
          fecha: new Date('2026-08-16T00:00:00.000Z'),
        }),
      );
    });

    it('should default fecha y caja a HOY cuando el input no trae fecha', async () => {
      mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 9, salonId: 1, estado: 'ABIERTA' });
      mockGastoRepo.create.mockResolvedValue({ id: 1, cajaId: 9 });

      await useCase.execute(validInput);

      const hoy = getColombiaDateString();
      expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(1, hoy);
      expect(mockGastoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 9,
          fecha: new Date(`${hoy}T00:00:00.000Z`),
        }),
      );
    });
  });
});
