import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrarPagoUseCase } from '../RegistrarPagoUseCase';
import { ValidationError } from '../../../../../shared/errors';

// ── Mocks ──────────────────────────────────────────────────────
const mockPrestamoRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};
const mockPagoRepo = {
  create: vi.fn(),
};
const mockCajaRepo = {
  findAbiertaBySalonYFecha: vi.fn(),
};

const makePrestamo = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  salonId: 1,
  usuarioId: 2,
  monto: 100000,
  saldoPendiente: 100000,
  estado: 'ACTIVO',
  ...overrides,
});

describe('RegistrarPagoUseCase (Rule C)', () => {
  let useCase: RegistrarPagoUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RegistrarPagoUseCase(
      mockPrestamoRepo as never,
      mockPagoRepo as never,
      mockCajaRepo as never,
    );
    mockPrestamoRepo.findById.mockResolvedValue(makePrestamo());
    mockPrestamoRepo.update.mockResolvedValue(makePrestamo());
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue({ id: 55, salonId: 1, estado: 'ABIERTA' });
    mockPagoRepo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 1,
      ...data,
    }));
  });

  it('persiste metodoPago EFECTIVO y la caja abierta para sumarlo al arqueo (INFLOW)', async () => {
    await useCase.execute({ prestamoId: 7, monto: 30000 });

    expect(mockCajaRepo.findAbiertaBySalonYFecha).toHaveBeenCalledWith(
      1,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(mockPagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ prestamoId: 7, monto: 30000, metodoPago: 'EFECTIVO', cajaId: 55 }),
    );
  });

  it('respeta un metodoPago explícito (TRANSFERENCIA)', async () => {
    await useCase.execute({ prestamoId: 7, monto: 30000, metodoPago: 'TRANSFERENCIA' as never });

    expect(mockPagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ metodoPago: 'TRANSFERENCIA' }),
    );
  });

  it('cajaId null cuando no hay caja abierta (no se inventa caja)', async () => {
    mockCajaRepo.findAbiertaBySalonYFecha.mockResolvedValue(null);

    await useCase.execute({ prestamoId: 7, monto: 30000 });

    expect(mockPagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cajaId: null }),
    );
  });

  it('rechaza monto no positivo sin registrar pago', async () => {
    await expect(useCase.execute({ prestamoId: 7, monto: 0 })).rejects.toBeInstanceOf(ValidationError);
    expect(mockPagoRepo.create).not.toHaveBeenCalled();
  });

  it('actualiza el saldo pendiente tras el pago', async () => {
    const result = await useCase.execute({ prestamoId: 7, monto: 30000 });

    expect(mockPrestamoRepo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ saldoPendiente: 70000, estado: 'ACTIVO' }),
    );
    expect(result.saldoRestante).toBe(70000);
  });
});
