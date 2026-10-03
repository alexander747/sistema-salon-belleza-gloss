import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity module to prevent TypeORM decorator evaluation.
vi.mock('../../../../../infrastructure/persistence/entities/PagoTransaccionEntity.js', () => ({
  MetodoPago: { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', TRANSFERENCIA: 'TRANSFERENCIA' },
}));

import { CrearPrestamoUseCase } from '../CrearPrestamoUseCase';

const mockPrestamoRepo = {
  create: vi.fn(),
};
const mockGastoRepo = {
  create: vi.fn(),
};
const mockUsuarioRepo = {
  findBySalonAndId: vi.fn(),
};

describe('CrearPrestamoUseCase', () => {
  let useCase: CrearPrestamoUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CrearPrestamoUseCase(
      mockPrestamoRepo as never,
      mockGastoRepo as never,
      mockUsuarioRepo as never,
    );
  });

  it('crea el gasto del préstamo VINCULADO con prestamoId', async () => {
    mockUsuarioRepo.findBySalonAndId.mockResolvedValue({ nombre: 'Ana' });
    mockPrestamoRepo.create.mockResolvedValue({
      id: 42,
      salonId: 1,
      usuarioId: 7,
      nombreTercero: null,
      monto: 1000,
      saldoPendiente: 1000,
      motivo: null,
      estado: 'ACTIVO',
      fechaCreacion: new Date('2026-10-02'),
    });
    mockGastoRepo.create.mockResolvedValue({ id: 1 });

    await useCase.execute({ salonId: 1, usuarioId: 7, monto: 1000, registradoPorId: 2 } as never);

    expect(mockGastoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 1,
        descripcion: 'Préstamo a Ana',
        monto: 1000,
        categoria: 'Prestamo',
        prestamoId: 42,
      }),
    );
  });

  it('préstamo a tercero: el gasto usa el nombre del tercero', async () => {
    mockPrestamoRepo.create.mockResolvedValue({
      id: 5,
      salonId: 1,
      usuarioId: null,
      nombreTercero: 'Pedro',
      monto: 500,
      saldoPendiente: 500,
      estado: 'ACTIVO',
      fechaCreacion: new Date('2026-10-02'),
    });
    mockGastoRepo.create.mockResolvedValue({ id: 2 });

    await useCase.execute({ salonId: 1, nombreTercero: 'Pedro', monto: 500 } as never);

    expect(mockGastoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: 'Préstamo a Pedro', prestamoId: 5 }),
    );
  });
});
