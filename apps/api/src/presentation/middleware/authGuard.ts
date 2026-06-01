import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { JwtTokenService } from '../../modules/auth/infrastructure/services/JwtTokenService';

const tokenService = new JwtTokenService();

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acceso requerido', { code: 'MISSING_TOKEN' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = tokenService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      salonId: payload.salonId,
      nombre: payload.nombre,
    };
    next();
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      const jwtErr = error as { name: string };
      if (jwtErr.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token expirado', { code: 'TOKEN_EXPIRED' });
      }
      if (jwtErr.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Token inválido', { code: 'TOKEN_INVALID' });
      }
    }
    throw new UnauthorizedError('Token inválido', { code: 'TOKEN_INVALID' });
  }
}
