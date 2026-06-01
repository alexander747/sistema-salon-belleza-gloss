import 'reflect-metadata';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../shared/errors';

// Mock JwtTokenService
vi.mock('../../../modules/auth/infrastructure/services/JwtTokenService.js', () => ({
  JwtTokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: vi.fn((token: string) => {
      if (token === 'valid_token') {
        return { sub: 1, email: 'admin@test.com', rol: 1, salonId: 0, nombre: 'Admin' };
      }
      if (token === 'expired_token') {
        throw Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
      }
      throw Object.assign(new Error('invalid token'), { name: 'JsonWebTokenError' });
    }),
  })),
}));

// Must import after the mock is set up
let authGuard: any;

describe('authGuard', () => {
  beforeAll(async () => {
    authGuard = (await import('../authGuard.js')).authGuard;
  });
  it('should call next() when a valid JWT is provided', () => {
    const req = {
      headers: { authorization: 'Bearer valid_token' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    authGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe(1);
  });

  it('should throw UnauthorizedError when no Authorization header', () => {
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => authGuard(req, res, next)).toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when header is not Bearer', () => {
    const req = {
      headers: { authorization: 'Basic xyz' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => authGuard(req, res, next)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when token is expired', () => {
    const req = {
      headers: { authorization: 'Bearer expired_token' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => authGuard(req, res, next)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when token is invalid', () => {
    const req = {
      headers: { authorization: 'Bearer invalid_token' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => authGuard(req, res, next)).toThrow(UnauthorizedError);
  });
});
