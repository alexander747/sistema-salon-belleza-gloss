import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '@pos-final/validation';
import { ValidationError } from '../../../../shared/errors';
import { CuentasCobrarUseCase } from '../../application/use-cases/cuentas/CuentasCobrarUseCase';
import { CuentasPagarUseCase } from '../../application/use-cases/cuentas/CuentasPagarUseCase';

@injectable()
export class CuentasController {
  constructor(
    @inject(CuentasCobrarUseCase) private readonly cobrarUseCase: CuentasCobrarUseCase,
    @inject(CuentasPagarUseCase) private readonly pagarUseCase: CuentasPagarUseCase,
  ) {}

  cobrar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = this.parsePaginacion(req);
      const result = await this.cobrarUseCase.execute({
        salonId: req.salonId!,
        page,
        limit,
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  pagar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = this.parsePaginacion(req);
      const result = await this.pagarUseCase.execute({
        salonId: req.salonId!,
        page,
        limit,
      });
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  private parsePaginacion(req: Request): { page: number; limit: number } {
    const pag = paginationSchema.safeParse(req.query);
    if (!pag.success) {
      throw new ValidationError('Parámetros de paginación inválidos', pag.error.flatten());
    }
    return { page: pag.data.page, limit: pag.data.limit };
  }
}
