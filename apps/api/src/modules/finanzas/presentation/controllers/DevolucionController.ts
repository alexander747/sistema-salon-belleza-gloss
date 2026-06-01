import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListDevolucionesUseCase } from '../../application/use-cases/devolucion/ListDevolucionesUseCase';
import { CreateDevolucionUseCase } from '../../application/use-cases/devolucion/CreateDevolucionUseCase';
import { paginationSchema } from '@pos-final/validation';

@injectable()
export class DevolucionController {
  constructor(
    @inject(ListDevolucionesUseCase) private readonly listUseCase: ListDevolucionesUseCase,
    @inject(CreateDevolucionUseCase) private readonly createUseCase: CreateDevolucionUseCase,
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
        registroServicioId: req.query.registroServicioId
          ? Number(req.query.registroServicioId)
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
}
