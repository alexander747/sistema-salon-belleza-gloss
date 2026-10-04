import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paginationSchema } from '@pos-final/validation';
import { ValidationError } from '../../../../shared/errors';
import { CuentasCobrarUseCase } from '../../application/use-cases/cuentas/CuentasCobrarUseCase';
import { CuentasPagarUseCase } from '../../application/use-cases/cuentas/CuentasPagarUseCase';

// Validación inline del query (mismo criterio que RegistroController/ReporteController:
// evita rebuild del dist de @pos-final/validation). `nombre` es un filtro opcional
// case-insensitive por nombre de cliente/préstamo/empleada.
const CUENTAS_QUERY_SCHEMA = paginationSchema.extend({
  nombre: z.string().trim().max(100).optional(),
});

@injectable()
export class CuentasController {
  constructor(
    @inject(CuentasCobrarUseCase) private readonly cobrarUseCase: CuentasCobrarUseCase,
    @inject(CuentasPagarUseCase) private readonly pagarUseCase: CuentasPagarUseCase,
  ) {}

  cobrar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, nombre } = this.parseQuery(req);
      const result = await this.cobrarUseCase.execute({
        salonId: req.salonId!,
        page,
        limit,
        ...(nombre ? { nombre } : {}),
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  pagar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, nombre } = this.parseQuery(req);
      const result = await this.pagarUseCase.execute({
        salonId: req.salonId!,
        page,
        limit,
        ...(nombre ? { nombre } : {}),
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  private parseQuery(req: Request): { page: number; limit: number; nombre?: string } {
    const parsed = CUENTAS_QUERY_SCHEMA.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Parámetros de paginación inválidos', parsed.error.flatten());
    }
    const nombre = parsed.data.nombre?.trim();
    return { page: parsed.data.page, limit: parsed.data.limit, nombre: nombre || undefined };
  }
}
