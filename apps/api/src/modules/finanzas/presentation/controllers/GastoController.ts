import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListGastosUseCase } from '../../application/use-cases/gasto/ListGastosUseCase';
import { CreateGastoUseCase } from '../../application/use-cases/gasto/CreateGastoUseCase';
import { DeleteGastoUseCase } from '../../application/use-cases/gasto/DeleteGastoUseCase';
import { paginationSchema } from '@pos-final/validation';

@injectable()
export class GastoController {
  constructor(
    @inject(ListGastosUseCase) private readonly listUseCase: ListGastosUseCase,
    @inject(CreateGastoUseCase) private readonly createUseCase: CreateGastoUseCase,
    @inject(DeleteGastoUseCase) private readonly deleteUseCase: DeleteGastoUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pag = paginationSchema.safeParse(req.query);
      const page = pag.success ? pag.data.page : 1;
      const limit = pag.success ? pag.data.limit : 0;

      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        page,
        limit,
        desde: req.query.desde ? new Date(req.query.desde as string) : undefined,
        hasta: req.query.hasta ? new Date(req.query.hasta as string) : undefined,
        esGastoFijo: req.query.esGastoFijo !== undefined
          ? req.query.esGastoFijo === 'true'
          : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.createUseCase.execute({
        ...req.body,
        salonId: req.salonId!,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({
        id: Number(req.params.id),
        salonId: req.salonId!,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
