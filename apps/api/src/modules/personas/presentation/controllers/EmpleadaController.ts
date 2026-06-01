import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListEmpleadasUseCase } from '../../application/use-cases/empleada/ListEmpleadasUseCase';
import { GetEmpleadaUseCase } from '../../application/use-cases/empleada/GetEmpleadaUseCase';
import { CreateEmpleadaUseCase } from '../../application/use-cases/empleada/CreateEmpleadaUseCase';
import { UpdateEmpleadaUseCase } from '../../application/use-cases/empleada/UpdateEmpleadaUseCase';
import { ActivateEmpleadaUseCase } from '../../application/use-cases/empleada/ActivateEmpleadaUseCase';
import { DeactivateEmpleadaUseCase } from '../../application/use-cases/empleada/DeactivateEmpleadaUseCase';

@injectable()
export class EmpleadaController {
  constructor(
    @inject('ListEmpleadasUseCase') private readonly listUseCase: ListEmpleadasUseCase,
    @inject('GetEmpleadaUseCase') private readonly getUseCase: GetEmpleadaUseCase,
    @inject('CreateEmpleadaUseCase') private readonly createUseCase: CreateEmpleadaUseCase,
    @inject('UpdateEmpleadaUseCase') private readonly updateUseCase: UpdateEmpleadaUseCase,
    @inject('ActivateEmpleadaUseCase') private readonly activateUseCase: ActivateEmpleadaUseCase,
    @inject('DeactivateEmpleadaUseCase') private readonly deactivateUseCase: DeactivateEmpleadaUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        userRol: req.user!.rol,
        rol: req.query.rol ? Number(req.query.rol) : undefined,
        activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
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
        userRol: req.user!.rol,
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
        userRol: req.user!.rol,
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
        userRol: req.user!.rol,
        ...req.body,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.activateUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deactivateUseCase.execute({
        salonId: req.salonId!,
        id: Number(req.params.id),
        requestingUserId: req.user!.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
