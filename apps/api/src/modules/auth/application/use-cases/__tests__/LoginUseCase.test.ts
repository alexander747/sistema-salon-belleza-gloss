import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { LoginUseCase } from '../LoginUseCase';
import { UnauthorizedError } from '../../../../../shared/errors';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import type { ITokenService } from '../../../domain/ports/ITokenService';
import type { IBcryptService } from '../../../infrastructure/services/BcryptService';
import { Rol } from '@pos-final/types';

function makeMockUser(overrides: Partial<{
  id: number;
  nombre: string;
  email: string;
  passwordHash: string | null;
  rol: Rol;
  salonId: number;
  activo: boolean;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    nombre: overrides.nombre ?? 'Admin',
    email: overrides.email ?? 'admin@posfinal.app',
    passwordHash: overrides.passwordHash ?? 'hashed_password',
    rol: overrides.rol ?? Rol.SUPERADMIN,
    salonId: overrides.salonId ?? 0,
    activo: overrides.activo ?? true,
  };
}

describe('LoginUseCase', () => {
  const createMocks = () => ({
    usuarioRepo: {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByPhone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    } as unknown as IUsuarioRepository,
    tokenService: {
      generateAccessToken: vi.fn().mockReturnValue('access_token'),
      generateRefreshToken: vi.fn().mockResolvedValue('refresh_token'),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      invalidateTokenFamily: vi.fn(),
    } as unknown as ITokenService,
    bcryptService: {
      hashPassword: vi.fn(),
      comparePassword: vi.fn(),
    } as IBcryptService,
    salonRepo: {
      findAll: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Default Salon' }]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByApiKey: vi.fn(),
    } as unknown as import('../../../../salon/domain/ports/ISalonRepository').ISalonRepository,
  });

  it('should return tokens when credentials are valid', async () => {
    const mocks = createMocks();
    const user = makeMockUser();
    mocks.usuarioRepo.findByEmail = vi.fn().mockResolvedValue(user);
    mocks.bcryptService.comparePassword = vi.fn().mockResolvedValue(true);

    const useCase = new LoginUseCase(mocks.usuarioRepo, mocks.tokenService, mocks.bcryptService, mocks.salonRepo);
    const result = await useCase.execute({ email: 'admin@posfinal.app', password: 'admin123' });

    expect(result.accessToken).toBe('access_token');
    expect(result.refreshToken).toBe('refresh_token');
    expect(result.user.id).toBe(1);
    expect(result.user.email).toBe('admin@posfinal.app');
    expect(result.user.rol).toBe(Rol.SUPERADMIN);
    expect(mocks.usuarioRepo.findByEmail).toHaveBeenCalledWith('admin@posfinal.app');
    expect(mocks.bcryptService.comparePassword).toHaveBeenCalledWith('admin123', 'hashed_password');
  });

  it('should throw UnauthorizedError when email is not found', async () => {
    const mocks = createMocks();
    mocks.usuarioRepo.findByEmail = vi.fn().mockResolvedValue(null);

    const useCase = new LoginUseCase(mocks.usuarioRepo, mocks.tokenService, mocks.bcryptService, mocks.salonRepo);

    await expect(
      useCase.execute({ email: 'unknown@test.com', password: 'pass123' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when password is wrong', async () => {
    const mocks = createMocks();
    const user = makeMockUser();
    mocks.usuarioRepo.findByEmail = vi.fn().mockResolvedValue(user);
    mocks.bcryptService.comparePassword = vi.fn().mockResolvedValue(false);

    const useCase = new LoginUseCase(mocks.usuarioRepo, mocks.tokenService, mocks.bcryptService, mocks.salonRepo);

    await expect(
      useCase.execute({ email: 'admin@posfinal.app', password: 'wrongpass' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user is inactive', async () => {
    const mocks = createMocks();
    const user = makeMockUser({ activo: false });
    mocks.usuarioRepo.findByEmail = vi.fn().mockResolvedValue(user);

    const useCase = new LoginUseCase(mocks.usuarioRepo, mocks.tokenService, mocks.bcryptService, mocks.salonRepo);

    await expect(
      useCase.execute({ email: 'admin@posfinal.app', password: 'admin123' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no passwordHash', async () => {
    const mocks = createMocks();
    const user = makeMockUser({ passwordHash: null });
    mocks.usuarioRepo.findByEmail = vi.fn().mockResolvedValue(user);

    const useCase = new LoginUseCase(mocks.usuarioRepo, mocks.tokenService, mocks.bcryptService, mocks.salonRepo);

    await expect(
      useCase.execute({ email: 'admin@posfinal.app', password: 'admin123' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
