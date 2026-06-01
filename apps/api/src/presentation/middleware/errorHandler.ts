import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';
import logger from '../../shared/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn({ err, statusCode: err.statusCode, code: err.code }, 'AppError handled');
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  // Unknown error — log full stack, return generic 500
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      details: null,
    },
  });
}
