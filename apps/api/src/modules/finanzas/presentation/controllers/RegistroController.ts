import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { CreateRegistroUseCase } from '../../application/use-cases/registro/CreateRegistroUseCase';
import { ListRegistrosUseCase } from '../../application/use-cases/registro/ListRegistrosUseCase';
import { GetRegistroUseCase } from '../../application/use-cases/registro/GetRegistroUseCase';
import { AnularRegistroUseCase } from '../../application/use-cases/registro/AnularRegistroUseCase';
import { paginationSchema } from '@pos-final/validation';

@injectable()
export class RegistroController {
  constructor(
    @inject(CreateRegistroUseCase) private readonly createUseCase: CreateRegistroUseCase,
    @inject(ListRegistrosUseCase) private readonly listUseCase: ListRegistrosUseCase,
    @inject(GetRegistroUseCase) private readonly getUseCase: GetRegistroUseCase,
    @inject(AnularRegistroUseCase) private readonly anularUseCase: AnularRegistroUseCase,
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
        desde: req.query.desde ? new Date((req.query.desde as string) + 'T00:00:00-05:00') : undefined,
        hasta: req.query.hasta ? new Date((req.query.hasta as string) + 'T23:59:59-05:00') : undefined,
        usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
        clienteId: req.query.clienteId ? Number(req.query.clienteId) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
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
        ...req.body,
        salonId: req.salonId!,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  anular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.anularUseCase.execute({
        id: Number(req.params.id),
        salonId: req.salonId!,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
