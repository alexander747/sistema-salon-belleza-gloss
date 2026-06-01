import type { Request, Response, NextFunction } from 'express';
import { Rol } from '@pos-final/types';
import { ForbiddenError } from '../../shared/errors';

export function requireRole(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ForbiddenError('No autenticado', { code: 'NOT_AUTHENTICATED' });
    }

    if (!roles.includes(req.user.rol)) {
      throw new ForbiddenError('No tienes permisos para acceder a este recurso', {
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
}
