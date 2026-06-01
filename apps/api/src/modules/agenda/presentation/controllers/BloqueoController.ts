import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListBloqueosUseCase } from '../../application/use-cases/bloqueo/ListBloqueosUseCase';
import { CreateBloqueoUseCase } from '../../application/use-cases/bloqueo/CreateBloqueoUseCase';
import { DeleteBloqueoUseCase } from '../../application/use-cases/bloqueo/DeleteBloqueoUseCase';

@injectable()
export class BloqueoController {
  constructor(
    @inject('ListBloqueosUseCase') private readonly listUseCase: ListBloqueosUseCase,
    @inject('CreateBloqueoUseCase') private readonly createUseCase: CreateBloqueoUseCase,
    @inject('DeleteBloqueoUseCase') private readonly deleteUseCase: DeleteBloqueoUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
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
        fechaInicio: new Date(req.body.fechaInicio),
        fechaFin: new Date(req.body.fechaFin),
        tipo: req.body.tipo,
        motivo: req.body.motivo,
        usuarioId: req.body.usuarioId ?? null,
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
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
