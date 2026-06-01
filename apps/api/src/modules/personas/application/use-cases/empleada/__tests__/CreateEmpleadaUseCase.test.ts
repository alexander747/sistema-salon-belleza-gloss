import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { CreateEmpleadaUseCase } from '../CreateEmpleadaUseCase';
import { ConflictError } from '../../../../../../shared/errors';
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
    salonId: 1,
    passwordHash: 'hashed_password',
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('CreateEmpleadaUseCase', () => {
  const createMocks = () => ({
    usuarioRepo: {
      findBySalon: vi.fn(),
      findBySalonAndId: vi.fn(),
      findBySalonAndPhone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateActivo: vi.fn(),
    } as unknown as IUsuarioRepository,
    bcryptService: {
      hashPassword: vi.fn(),
      comparePassword: vi.fn(),
    } as unknown as IBcryptService,
  });

  it('should hash password before creating empleada', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndPhone = vi.fn().mockResolvedValue(null);
    mocks.bcryptService.hashPassword = vi.fn().mockResolvedValue('hashed_password');
    mocks.usuarioRepo.create = vi.fn().mockResolvedValue(makeMockEmpleada());

    const useCase = new CreateEmpleadaUseCase(mocks.usuarioRepo, mocks.bcryptService);
    await useCase.execute({
      salonId: 1,
      nombre: 'Maria',
      numeroWhatsApp: '+541116789',
      email: 'maria@test.com',
      password: 'secreto123',
      rol: Rol.MANICURISTA,
      userRol: Rol.DUEÑA,
    });

    expect(mocks.bcryptService.hashPassword).toHaveBeenCalledWith('secreto123');
    expect(mocks.usuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed_password' }),
    );
  });

  it('should reject duplicate phone number', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findBySalonAndPhone = vi.fn().mockResolvedValue(makeMockEmpleada());

    const useCase = new CreateEmpleadaUseCase(mocks.usuarioRepo, mocks.bcryptService);

    await expect(
      useCase.execute({
        salonId: 1,
        nombre: 'Maria',
        numeroWhatsApp: '+541116789',
        email: 'maria@test.com',
        password: 'secreto123',
        rol: Rol.MANICURISTA,
        userRol: Rol.DUEÑA,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
