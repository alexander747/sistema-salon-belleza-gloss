import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { DeactivateEmpleadaUseCase } from '../DeactivateEmpleadaUseCase';
import { UnprocessableEntityError, NotFoundError } from '../../../../../../shared/errors';
import type { IUsuarioRepository } from '../../../../domain/ports/IUsuarioRepository';

function makeMockEmpleada(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    nombre: 'Maria',
    numeroWhatsApp: '+541116789',
    email: 'maria@test.com',
    rol: 4,
    activo: true,
    salonId: 1,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('DeactivateEmpleadaUseCase', () => {
  const createMocks = () => ({
    usuarioRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findBySalonAndPhone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateActivo: vi.fn(),
    } as unknown as IUsuarioRepository,
  });

  it('should block self-deactivation', async () => {
    const mocks = createMocks();

    const useCase = new DeactivateEmpleadaUseCase(mocks.usuarioRepo);

    await expect(
      useCase.execute({
        salonId: 1,
        id: 1,
        requestingUserId: 1,
      }),
    ).rejects.toThrow(UnprocessableEntityError);
  });

  it('should throw NotFoundError when empleada does not exist', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndId = vi.fn().mockResolvedValue(null);

    const useCase = new DeactivateEmpleadaUseCase(mocks.usuarioRepo);

    await expect(
      useCase.execute({
        salonId: 1,
        id: 999,
        requestingUserId: 1,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should deactivate another empleada successfully', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndId = vi.fn().mockResolvedValue(makeMockEmpleada());
    mocks.usuarioRepo.updateActivo = vi.fn().mockResolvedValue(true);

    const useCase = new DeactivateEmpleadaUseCase(mocks.usuarioRepo);
    const result = await useCase.execute({
      salonId: 1,
      id: 5,
      requestingUserId: 1,
    });

    expect(result).toEqual({ activo: false });
    expect(mocks.usuarioRepo.updateActivo).toHaveBeenCalledWith(5, false);
  });
});
