import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { GetHorariosUseCase } from '../../application/use-cases/horario/GetHorariosUseCase';
import { UpsertHorariosUseCase } from '../../application/use-cases/horario/UpsertHorariosUseCase';

@injectable()
export class HorarioController {
  constructor(
    @inject('GetHorariosUseCase') private readonly getUseCase: GetHorariosUseCase,
    @inject('UpsertHorariosUseCase') private readonly upsertUseCase: UpsertHorariosUseCase,
  ) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        salonId: req.salonId!,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  upsert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.upsertUseCase.execute({
        salonId: req.salonId!,
        horarios: req.body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
