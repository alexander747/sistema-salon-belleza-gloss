import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { NominaPendienteUseCase } from '../../application/use-cases/liquidacion/NominaPendienteUseCase';
import { LiquidarEmpleadaUseCase } from '../../application/use-cases/liquidacion/LiquidarEmpleadaUseCase';
import { HistorialLiquidacionesUseCase } from '../../application/use-cases/liquidacion/HistorialLiquidacionesUseCase';

@injectable()
export class LiquidacionController {
  constructor(
    @inject(NominaPendienteUseCase) private readonly nominaUseCase: NominaPendienteUseCase,
    @inject(LiquidarEmpleadaUseCase) private readonly liquidarUseCase: LiquidarEmpleadaUseCase,
    @inject(HistorialLiquidacionesUseCase) private readonly historialUseCase: HistorialLiquidacionesUseCase,
  ) {}

  nominaPendiente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.nominaUseCase.execute({
        salonId: req.salonId!,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  liquidarEmpleada = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.liquidarUseCase.execute({
        salonId: req.salonId!,
        usuarioId: req.body.usuarioId,
        periodoInicio: new Date(req.body.periodoInicio),
        periodoFin: new Date(req.body.periodoFin),
        totalPagado: req.body.totalPagado ? Number(req.body.totalPagado) : undefined,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  historial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.historialUseCase.execute({
        salonId: req.salonId!,
        usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
