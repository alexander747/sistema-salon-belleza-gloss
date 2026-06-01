import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../AuthController';
import { UnauthorizedError } from '../../../../../shared/errors';

describe('AuthController', () => {
  let controller: AuthController;
  let mockLoginUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockRefreshUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetCurrentUserUseCase: { execute: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLoginUseCase = { execute: vi.fn() };
    mockRefreshUseCase = { execute: vi.fn() };
    mockGetCurrentUserUseCase = { execute: vi.fn() };
    next = vi.fn();
    controller = new AuthController(
      mockLoginUseCase as never,
      mockRefreshUseCase as never,
      mockGetCurrentUserUseCase as never,
    );
  });

  describe('login', () => {
    it('should return 200 with tokens on valid credentials', async () => {
      const expectedResult = {
        accessToken: 'token123',
        refreshToken: 'refresh123',
        user: { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 1, salonId: 0 },
      };
      mockLoginUseCase.execute.mockResolvedValue(expectedResult);

      const req = { body: { email: 'admin@test.com', password: 'pass123' } } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedResult);
      expect(mockLoginUseCase.execute).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'pass123',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when credentials are invalid', async () => {
      const error = new UnauthorizedError('Credenciales inválidas');
      mockLoginUseCase.execute.mockRejectedValue(error);

      const req = { body: { email: 'bad@test.com', password: 'wrong' } } as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('should return user info when authenticated', async () => {
      const userData = {
        id: 1,
        nombre: 'Admin',
        email: 'admin@test.com',
        rol: 1,
        salonId: 0,
        activo: true,
      };
      mockGetCurrentUserUseCase.execute.mockResolvedValue(userData);

      const req = { user: { id: 1 } } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(userData);
      expect(mockGetCurrentUserUseCase.execute).toHaveBeenCalledWith(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should return new tokens on valid refresh token', async () => {
      const expectedResult = {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        user: { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 1, salonId: 0 },
      };
      mockRefreshUseCase.execute.mockResolvedValue(expectedResult);

      const req = { body: { refreshToken: 'valid_refresh' } } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.refresh(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedResult);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
