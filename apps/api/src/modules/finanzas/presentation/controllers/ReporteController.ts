import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ResumenDiaUseCase } from '../../application/use-cases/reporte/ResumenDiaUseCase';
import { ROIMensualUseCase } from '../../application/use-cases/reporte/ROIMensualUseCase';
import { CierreTurnoUseCase } from '../../application/use-cases/reporte/CierreTurnoUseCase';

@injectable()
export class ReporteController {
  constructor(
    @inject(ResumenDiaUseCase) private readonly resumenDiaUseCase: ResumenDiaUseCase,
    @inject(ROIMensualUseCase) private readonly roiMensualUseCase: ROIMensualUseCase,
    @inject(CierreTurnoUseCase) private readonly cierreTurnoUseCase: CierreTurnoUseCase,
  ) {}

  resumenDia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const desde = req.query.desde as string | undefined;
      const hasta = req.query.hasta as string | undefined;
      const fecha = req.query.fecha as string | undefined;

      const result = await this.resumenDiaUseCase.execute({
        salonId: req.salonId!,
        ...(desde && hasta ? { desde, hasta } : { fecha: fecha ?? new Date().toISOString().slice(0, 10) }),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  roiMensual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mes = req.query.mes
        ? new Date(req.query.mes as string + '-01')
        : new Date();

      const result = await this.roiMensualUseCase.execute({
        salonId: req.salonId!,
        mes,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cierreTurno = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = Number(req.params.id);
      const fecha = req.query.fecha
        ? new Date(req.query.fecha as string)
        : new Date();

      const result = await this.cierreTurnoUseCase.execute({
        salonId: req.salonId!,
        usuarioId,
        fecha,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
