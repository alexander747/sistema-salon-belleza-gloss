import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListServiciosUseCase } from '../../application/use-cases/servicio/ListServiciosUseCase';
import { GetServicioUseCase } from '../../application/use-cases/servicio/GetServicioUseCase';
import { CreateServicioUseCase } from '../../application/use-cases/servicio/CreateServicioUseCase';
import { UpdateServicioUseCase } from '../../application/use-cases/servicio/UpdateServicioUseCase';
import { DeleteServicioUseCase } from '../../application/use-cases/servicio/DeleteServicioUseCase';

@injectable()
export class ServicioController {
  constructor(
    @inject('ListServiciosUseCase') private readonly listUseCase: ListServiciosUseCase,
    @inject('GetServicioUseCase') private readonly getUseCase: GetServicioUseCase,
    @inject('CreateServicioUseCase') private readonly createUseCase: CreateServicioUseCase,
    @inject('UpdateServicioUseCase') private readonly updateUseCase: UpdateServicioUseCase,
    @inject('DeleteServicioUseCase') private readonly deleteUseCase: DeleteServicioUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoriaId = req.query.categoriaId
        ? Number(req.query.categoriaId)
        : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 0;
      const q = req.query.q as string | undefined;

      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        categoriaId,
        page,
        limit,
        q,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.createUseCase.execute({
        salonId: req.salonId!,
        ...req.body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        ...req.body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
