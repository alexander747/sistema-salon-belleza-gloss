import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ActivateClienteUseCase } from '../ActivateClienteUseCase';
import { NotFoundError } from '../../../../../../shared/errors';
import type { IClienteRepository } from '../../../../domain/ports/IClienteRepository';

function makeMockCliente(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Ana Gómez',
    telefono: '3128553060',
    cedula: null,
    activo: false,
    salonId: 1,
    ...overrides,
  };
}

describe('ActivateClienteUseCase', () => {
  const createMocks = () => ({
    clienteRepo: {
      findBySalonAndId: vi.fn(),
      findBySalonPaginated: vi.fn(),
      findBySalonAndTelefono: vi.fn(),
      findBySalonAndCedula: vi.fn(),
      countBySalon: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as unknown as IClienteRepository,
  });

  it('should throw NotFoundError when cliente does not exist', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId = vi.fn().mockResolvedValue(null);

    const useCase = new ActivateClienteUseCase(mocks.clienteRepo);

    await expect(useCase.execute({ salonId: 1, id: 999 })).rejects.toThrow(NotFoundError);
    expect(mocks.clienteRepo.update).not.toHaveBeenCalled();
  });

  it('should activate a cliente (activo=true)', async () => {
    const mocks = createMocks();
    mocks.clienteRepo.findBySalonAndId = vi.fn().mockResolvedValue(makeMockCliente());
    mocks.clienteRepo.update = vi.fn().mockResolvedValue(makeMockCliente({ activo: true }));

    const useCase = new ActivateClienteUseCase(mocks.clienteRepo);
    const result = await useCase.execute({ salonId: 1, id: 5 });

    expect(result).toEqual({ activo: true });
    expect(mocks.clienteRepo.update).toHaveBeenCalledWith(5, { activo: true });
  });
});
