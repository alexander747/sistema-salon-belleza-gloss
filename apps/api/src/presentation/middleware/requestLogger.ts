import type { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../shared/database';
import { BitacoraEntity, MetodoBitacora, NivelBitacora } from '../../infrastructure/persistence/entities/BitacoraEntity';
import logger from '../../shared/logger';

/**
 * Fire-and-forget request logger to Bitacora entity.
 * Never throws — all failures are silently caught and logged.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;

    const entry = new BitacoraEntity();
    entry.nivel = res.statusCode >= 500 ? NivelBitacora.ERROR
      : res.statusCode >= 400 ? NivelBitacora.WARN
      : NivelBitacora.INFO;
    entry.metodo = req.method as MetodoBitacora;
    entry.url = req.originalUrl;
    entry.accion = `${req.method} ${req.route?.path ?? req.originalUrl}`;
    entry.mensaje = `Request completed in ${duration}ms`;
    entry.statusCode = res.statusCode;
    entry.salonId = req.salonId ?? null;
    entry.usuarioId = req.user?.id ?? null;
    entry.nombreSalon = '';
    entry.nombreUsuario = req.user?.nombre ?? '';

    // Store request body for non-GET (strip sensitive fields)
    if (req.method !== 'GET' && req.body) {
      const sanitized = { ...req.body };
      delete sanitized.password;
      delete sanitized.passwordHash;
      delete sanitized.refreshToken;
      entry.requestData = sanitized;
    }

    // Fire and forget — never block the response
    AppDataSource.getRepository(BitacoraEntity)
      .save(entry)
      .catch((err) => {
        logger.error({ err }, 'Failed to save bitacora entry');
      });
  });

  next();
}
