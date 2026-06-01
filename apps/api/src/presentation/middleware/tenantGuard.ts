import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../shared/errors';
import { Rol } from '@pos-final/types';

export function tenantGuard(req: Request, _res: Response, next: NextFunction): void {
  // n8n routes: apiKeyGuard already set req.salonId
  if (req.salonId !== undefined && !req.user) {
    // Already set by apiKeyGuard, just validate :salonId param matches
    const paramSalonId = parseInt(req.params.salonId, 10);
    if (!isNaN(paramSalonId) && req.salonId !== paramSalonId) {
      throw new ForbiddenError('Acceso denegado a este salón', { code: 'TENANT_MISMATCH' });
    }
    next();
    return;
  }

  // JWT routes: extract from req.user
  if (!req.user) {
    throw new ForbiddenError('No autenticado', { code: 'NOT_AUTHENTICATED' });
  }

  // Superadmin impersonation via X-Salon-Id header
  const impersonateSalonId = req.headers['x-salon-id'];
  if (impersonateSalonId && req.user.rol === Rol.SUPERADMIN) {
    req.salonId = parseInt(impersonateSalonId as string, 10);
    next();
    return;
  }

  // SUPERADMIN with null/0 salonId: fall back to URL param
  if (req.user.rol === Rol.SUPERADMIN && (!req.user.salonId || req.user.salonId === 0)) {
    const paramSalonId = parseInt(req.params.salonId, 10);
    if (!isNaN(paramSalonId)) {
      req.salonId = paramSalonId;
      next();
      return;
    }
  }

  req.salonId = req.user.salonId;

  // Validate against :salonId param if present in URL
  const paramSalonId = parseInt(req.params.salonId, 10);
  if (!isNaN(paramSalonId) && req.salonId !== paramSalonId) {
    throw new ForbiddenError('Acceso denegado a este salón', { code: 'TENANT_MISMATCH' });
  }

  next();
}
