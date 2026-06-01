import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { ListCitasUseCase } from '../../application/use-cases/cita/ListCitasUseCase';
import { GetCitaUseCase } from '../../application/use-cases/cita/GetCitaUseCase';
import { CreateCitaUseCase } from '../../application/use-cases/cita/CreateCitaUseCase';
import { CambiarEstadoCitaUseCase } from '../../application/use-cases/cita/CambiarEstadoCitaUseCase';
import { CancelCitaUseCase } from '../../application/use-cases/cita/CancelCitaUseCase';
import { CompletarCitaUseCase } from '../../application/use-cases/cita/CompletarCitaUseCase';

@injectable()
export class CitaController {
  constructor(
    @inject('ListCitasUseCase') private readonly listUseCase: ListCitasUseCase,
    @inject('GetCitaUseCase') private readonly getUseCase: GetCitaUseCase,
    @inject('CreateCitaUseCase') private readonly createUseCase: CreateCitaUseCase,
    @inject('CambiarEstadoCitaUseCase') private readonly cambiarEstadoUseCase: CambiarEstadoCitaUseCase,
    @inject('CancelCitaUseCase') private readonly cancelUseCase: CancelCitaUseCase,
    @inject('CompletarCitaUseCase') private readonly completarUseCase: CompletarCitaUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        salonId: req.salonId!,
        desde: req.query.desde ? new Date(req.query.desde as string) : undefined,
        hasta: req.query.hasta ? new Date(req.query.hasta as string) : undefined,
        usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
        clienteId: req.query.clienteId ? Number(req.query.clienteId) : undefined,
        estado: req.query.estado as any,
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
        salonId: req.salonId!,
        usuarioId: req.body.usuarioId,
        clienteId: req.body.clienteId,
        fechaHora: new Date(req.body.fechaHora),
        servicioIds: req.body.serviciosIds,
        notas: req.body.notas,
        esWalkIn: req.body.esWalkIn,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cambiarEstadoUseCase.execute({
        id: Number(req.params.id),
        estado: req.body.estado,
        usuarioId: req.user?.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cancelar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cancelUseCase.execute({
        id: Number(req.params.id),
        usuarioId: req.user?.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  completar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.completarUseCase.execute({
        id: Number(req.params.id),
        usuarioId: req.user?.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
