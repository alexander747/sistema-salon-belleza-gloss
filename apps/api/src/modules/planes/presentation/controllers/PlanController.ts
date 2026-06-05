import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { ListPlanesUseCase } from '../../application/use-cases/ListPlanesUseCase';
import { GetPlanByIdUseCase } from '../../application/use-cases/GetPlanByIdUseCase';
import { CreatePlanUseCase } from '../../application/use-cases/CreatePlanUseCase';
import { UpdatePlanUseCase } from '../../application/use-cases/UpdatePlanUseCase';
import { DeletePlanUseCase } from '../../application/use-cases/DeletePlanUseCase';

@injectable()
export class PlanController {
  constructor(
    @inject(ListPlanesUseCase) private readonly listUseCase: ListPlanesUseCase,
    @inject(GetPlanByIdUseCase) private readonly getUseCase: GetPlanByIdUseCase,
    @inject(CreatePlanUseCase) private readonly createUseCase: CreatePlanUseCase,
    @inject(UpdatePlanUseCase) private readonly updateUseCase: UpdatePlanUseCase,
    @inject(DeletePlanUseCase) private readonly deleteUseCase: DeletePlanUseCase,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const planes = await this.listUseCase.execute();
    res.json(planes);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const plan = await this.getUseCase.execute(id);
    if (!plan) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plan no encontrado' } });
      return;
    }
    res.json(plan);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const plan = await this.createUseCase.execute(req.body);
    res.status(201).json(plan);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const plan = await this.updateUseCase.execute(id, req.body);
    if (!plan) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plan no encontrado' } });
      return;
    }
    res.json(plan);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const deleted = await this.deleteUseCase.execute(id);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plan no encontrado' } });
      return;
    }
    res.status(204).send();
  };
}
