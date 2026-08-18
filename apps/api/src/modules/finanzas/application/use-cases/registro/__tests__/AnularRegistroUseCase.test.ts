import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock entity modules to prevent TypeORM decorator evaluation.
vi.mock('../../../../../../infrastructure/persistence/entities/RegistroProductoEntity.js', () => ({
  RegistroProductoEntity: class RegistroProductoEntity {
    id: number;
    registroServicioId: number;
    productoId: number;
    cantidad: number;
  },
}));

// Mock database (queryRunner solo se usa si hay productosVendidos)
vi.mock('../../../../../../shared/database.js', () => ({
  AppDataSource: {
    createQueryRunner: vi.fn(() => ({
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        getRepository: vi.fn(() => ({
          delete: vi.fn(),
        })),
      },
    })),
  },
}));

import { AnularRegistroUseCase } from '../AnularRegistroUseCase';
import { NotFoundError, UnprocessableEntityError } from '../../../../../../shared/errors';

// ── Mocks ──────────────────────────────────────────────────────
const mockRegistroRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};
const mockClienteRepo = {
  findBySalonAndId: vi.fn(),
  update: vi.fn(),
};
const mockProductoRepo = {
  incrementStock: vi.fn(),
};

describe('AnularRegistroUseCase', () => {
  let useCase: AnularRegistroUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AnularRegistroUseCase(
      mockRegistroRepo as never,
      mockClienteRepo as never,
      mockProductoRepo as never,
    );
  });

  it('should throw UnprocessableEntityError when the registro is already liquidado (estaPagadaEmpleada=true)', async () => {
    mockRegistroRepo.findById.mockResolvedValue({
      id: 1,
      salonId: 1,
      clienteId: 1,
      montoPendiente: 0,
      estaPagadaEmpleada: true,
      productosVendidos: [],
      notas: null,
    });

    await expect(useCase.execute({ id: 1, salonId: 1 })).rejects.toThrow(UnprocessableEntityError);
    // No se toca el registro: nada se anula ni se restaura
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
    expect(mockClienteRepo.update).not.toHaveBeenCalled();
  });

  it('should anular (soft-void) a registro NO liquidado y decrementar la deuda del cliente', async () => {
    mockRegistroRepo.findById.mockResolvedValue({
      id: 1,
      salonId: 1,
      clienteId: 1,
      montoPendiente: 50000,
      estaPagadaEmpleada: false,
      productosVendidos: [],
      notas: 'nota original',
    });
    mockRegistroRepo.update.mockResolvedValue({});
    mockClienteRepo.findBySalonAndId.mockResolvedValue({ id: 1, deudaTotal: 80000 });
    mockClienteRepo.update.mockResolvedValue({});

    await useCase.execute({ id: 1, salonId: 1 });

    expect(mockRegistroRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        estado: 'ANULADO',
        montoPendiente: 0,
        montoTotal: 0,
        comisionCalculada: 0,
        estaPagadaEmpleada: true,
        notas: '[ANULADO] nota original',
      }),
    );
    // Deuda del cliente: 80000 - 50000 = 30000
    expect(mockClienteRepo.update).toHaveBeenCalledWith(1, { deudaTotal: 30000 });
  });

  it('should throw NotFoundError when the registro does not exist', async () => {
    mockRegistroRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 999, salonId: 1 })).rejects.toThrow(NotFoundError);
    expect(mockRegistroRepo.update).not.toHaveBeenCalled();
  });
});
