import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../errorHandler';
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../shared/errors';

describe('errorHandler', () => {
  const makeRes = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    return res;
  };

  it('should return 404 JSON for NotFoundError', () => {
    const err = new NotFoundError('Salón no encontrado');
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Salón no encontrado',
        details: null,
      },
    });
  });

  it('should return 400 JSON for ValidationError', () => {
    const details = { email: ['El email no es válido'] };
    const err = new ValidationError('Datos inválidos', details);
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details,
      },
    });
  });

  it('should return 401 JSON for UnauthorizedError', () => {
    const err = new UnauthorizedError('Token requerido', { code: 'MISSING_TOKEN' });
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token requerido',
        details: { code: 'MISSING_TOKEN' },
      },
    });
  });

  it('should return 403 JSON for ForbiddenError', () => {
    const err = new ForbiddenError('Acceso denegado');
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Acceso denegado',
        details: null,
      },
    });
  });

  it('should return 409 JSON for ConflictError', () => {
    const err = new ConflictError('El email ya existe');
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'CONFLICT',
        message: 'El email ya existe',
        details: null,
      },
    });
  });

  it('should return 500 JSON for unknown errors', () => {
    const err = new Error('Algo salió mal');
    const res = makeRes();

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: null,
      },
    });
  });

  it('should return 500 for non-Error thrown values', () => {
    const res = makeRes();

    errorHandler('string error' as unknown as Error, {} as Request, res, {} as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: null,
      },
    });
  });
});
