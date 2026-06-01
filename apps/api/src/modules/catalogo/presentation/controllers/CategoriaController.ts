import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListCategoriasUseCase } from '../../application/use-cases/categoria/ListCategoriasUseCase';
import { CreateCategoriaUseCase } from '../../application/use-cases/categoria/CreateCategoriaUseCase';
import { UpdateCategoriaUseCase } from '../../application/use-cases/categoria/UpdateCategoriaUseCase';
import { DeleteCategoriaUseCase } from '../../application/use-cases/categoria/DeleteCategoriaUseCase';

@injectable()
export class CategoriaController {
  constructor(
    @inject('ListCategoriasUseCase') private readonly listUseCase: ListCategoriasUseCase,
    @inject('CreateCategoriaUseCase') private readonly createUseCase: CreateCategoriaUseCase,
    @inject('UpdateCategoriaUseCase') private readonly updateUseCase: UpdateCategoriaUseCase,
    @inject('DeleteCategoriaUseCase') private readonly deleteUseCase: DeleteCategoriaUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({ salonId: req.salonId! });
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
