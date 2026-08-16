import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { UpdateEmpleadaUseCase } from '../UpdateEmpleadaUseCase';
import { NotFoundError } from '../../../../../../shared/errors';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../../domain/ports/IUsuarioRepository';
import type { IBcryptService } from '../../../../../../modules/auth/infrastructure/services/BcryptService';

function makeMockEmpleada(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    nombre: 'Maria',
    numeroWhatsApp: '+541116789',
    email: 'maria@test.com',
    avatar: null,
    fechaNacimiento: null,
    rol: Rol.MANICURISTA,
    activo: true,
    porcentajeComisionServicio: '20',
    sueldoFijo: '40000',
    bonoHorario: '500',
    frecuenciaBono: null,
    frecuenciaPago: 'MENSUAL',
    salonId: 1,
    passwordHash: 'hashed_password',
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('UpdateEmpleadaUseCase', () => {
  const createMocks = () => ({
    usuarioRepo: {
      findBySalonAndId: vi.fn(),
      findBySalonAndPhone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as unknown as IUsuarioRepository,
    bcryptService: {
      hashPassword: vi.fn(),
    } as unknown as IBcryptService,
  });

  it('should throw NotFoundError when the empleada does not exist', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndId = vi.fn().mockResolvedValue(null);

    const useCase = new UpdateEmpleadaUseCase(mocks.usuarioRepo, mocks.bcryptService);

    await expect(
      useCase.execute({ salonId: 1, id: 99, userRol: Rol.DUEÑA }),
    ).rejects.toThrow(NotFoundError);
    expect(mocks.usuarioRepo.update).not.toHaveBeenCalled();
  });

  it('should pass frecuenciaPago through to the repository when provided', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndId = vi.fn().mockResolvedValue(makeMockEmpleada());
    mocks.usuarioRepo.update = vi.fn().mockResolvedValue(
      makeMockEmpleada({ frecuenciaPago: 'QUINCENAL' }),
    );

    const useCase = new UpdateEmpleadaUseCase(mocks.usuarioRepo, mocks.bcryptService);
    await useCase.execute({
      salonId: 1,
      id: 2,
      frecuenciaPago: 'QUINCENAL',
      userRol: Rol.DUEÑA,
    });

    expect(mocks.usuarioRepo.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ frecuenciaPago: 'QUINCENAL' }),
    );
  });

  it('should NOT include frecuenciaPago in the update when not provided', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndId = vi.fn().mockResolvedValue(makeMockEmpleada());
    mocks.usuarioRepo.update = vi.fn().mockResolvedValue(makeMockEmpleada());

    const useCase = new UpdateEmpleadaUseCase(mocks.usuarioRepo, mocks.bcryptService);
    await useCase.execute({ salonId: 1, id: 2, nombre: 'Nuevo nombre', userRol: Rol.DUEÑA });

    expect(mocks.usuarioRepo.update).toHaveBeenCalledWith(2, { nombre: 'Nuevo nombre' });
  });
});
