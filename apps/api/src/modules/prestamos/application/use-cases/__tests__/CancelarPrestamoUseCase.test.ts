import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelarPrestamoUseCase } from '../CancelarPrestamoUseCase';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

const mockPrestamoRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};
const mockGastoRepo = {
  findByPrestamoId: vi.fn(),
  delete: vi.fn(),
};

describe('CancelarPrestamoUseCase', () => {
  let useCase: CancelarPrestamoUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CancelarPrestamoUseCase(mockPrestamoRepo as never, mockGastoRepo as never);
  });

  it('cancela el préstamo y BORRA el gasto vinculado (revierte el egreso)', async () => {
    mockPrestamoRepo.findById.mockResolvedValue({ id: 3, estado: 'ACTIVO' });
    mockPrestamoRepo.update.mockResolvedValue(undefined);
    mockGastoRepo.findByPrestamoId.mockResolvedValue({ id: 9, prestamoId: 3 });
    mockGastoRepo.delete.mockResolvedValue(undefined);

    const result = await useCase.execute(3);

    expect(mockPrestamoRepo.update).toHaveBeenCalledWith(3, { estado: 'CANCELADO' });
    expect(mockGastoRepo.findByPrestamoId).toHaveBeenCalledWith(3);
    expect(mockGastoRepo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ id: 3, estado: 'CANCELADO' });
  });

  it('cancela sin gasto vinculado sin fallar', async () => {
    mockPrestamoRepo.findById.mockResolvedValue({ id: 3, estado: 'ACTIVO' });
    mockPrestamoRepo.update.mockResolvedValue(undefined);
    mockGastoRepo.findByPrestamoId.mockResolvedValue(null);

    await useCase.execute(3);

    expect(mockGastoRepo.delete).not.toHaveBeenCalled();
  });

  it('rechaza cancelar un préstamo que no está ACTIVO', async () => {
    mockPrestamoRepo.findById.mockResolvedValue({ id: 3, estado: 'PAGADO' });

    await expect(useCase.execute(3)).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(mockPrestamoRepo.update).not.toHaveBeenCalled();
  });

  it('lanza NotFound si el préstamo no existe', async () => {
    mockPrestamoRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(3)).rejects.toBeInstanceOf(NotFoundError);
  });
});
