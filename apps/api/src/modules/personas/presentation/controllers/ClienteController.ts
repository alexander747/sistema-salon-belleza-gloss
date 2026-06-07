import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListClientesUseCase } from '../../application/use-cases/cliente/ListClientesUseCase';
import { GetClienteUseCase } from '../../application/use-cases/cliente/GetClienteUseCase';
import { CreateClienteUseCase } from '../../application/use-cases/cliente/CreateClienteUseCase';
import { UpdateClienteUseCase } from '../../application/use-cases/cliente/UpdateClienteUseCase';
import { paginationSchema } from '@pos-final/validation';

@injectable()
export class ClienteController {
  constructor(
    @inject('ListClientesUseCase') private readonly listUseCase: ListClientesUseCase,
    @inject('GetClienteUseCase') private readonly getUseCase: GetClienteUseCase,
    @inject('CreateClienteUseCase') private readonly createUseCase: CreateClienteUseCase,
    @inject('UpdateClienteUseCase') private readonly updateUseCase: UpdateClienteUseCase,
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
        q: (req.query.q as string) || undefined,
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
      const { cliente, created } = await this.createUseCase.execute({
        salonId: req.salonId!,
        ...req.body,
      });
      res.status(created ? 201 : 200).json(cliente);
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
}
