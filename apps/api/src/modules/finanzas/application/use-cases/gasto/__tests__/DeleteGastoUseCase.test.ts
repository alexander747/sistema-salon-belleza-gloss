import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteGastoUseCase } from '../DeleteGastoUseCase';
import { NotFoundError, UnprocessableEntityError } from '../../../../../../shared/errors';

const mockGastoRepo = {
  findById: vi.fn(),
  delete: vi.fn(),
};

describe('DeleteGastoUseCase', () => {
  let useCase: DeleteGastoUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new DeleteGastoUseCase(mockGastoRepo as never);
  });

  it('borra un gasto suelto (prestamoId null)', async () => {
    mockGastoRepo.findById.mockResolvedValue({ id: 7, salonId: 1, prestamoId: null });
    mockGastoRepo.delete.mockResolvedValue(undefined);

    await useCase.execute({ id: 7, salonId: 1 });

    expect(mockGastoRepo.delete).toHaveBeenCalledWith(7);
  });

  it('rechaza borrar un gasto originado por un préstamo y NO lo borra', async () => {
    mockGastoRepo.findById.mockResolvedValue({ id: 7, salonId: 1, prestamoId: 3 });

    await expect(useCase.execute({ id: 7, salonId: 1 })).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
    expect(mockGastoRepo.delete).not.toHaveBeenCalled();
  });

  it('lanza NotFound si no existe o es de otro salón', async () => {
    mockGastoRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ id: 7, salonId: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });
});
