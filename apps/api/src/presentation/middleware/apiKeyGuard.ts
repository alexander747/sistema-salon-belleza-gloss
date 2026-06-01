import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { AppDataSource } from '../../shared/database';
import { SalonEntity } from '../../infrastructure/persistence/entities/SalonEntity';

export async function apiKeyGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw new UnauthorizedError('API key requerida', { code: 'MISSING_API_KEY' });
  }

  const salonRepo = AppDataSource.getRepository(SalonEntity);
  const salon = await salonRepo.findOneBy({ apiKeyN8n: apiKey });

  if (!salon) {
    throw new UnauthorizedError('API key inválida', { code: 'INVALID_API_KEY' });
  }

  req.salonId = salon.id;
  next();
}
