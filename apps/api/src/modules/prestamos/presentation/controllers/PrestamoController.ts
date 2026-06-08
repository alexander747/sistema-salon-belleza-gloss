import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { CrearPrestamoUseCase } from '../../application/use-cases/CrearPrestamoUseCase';
import { ListarPrestamosUseCase } from '../../application/use-cases/ListarPrestamosUseCase';
import { ObtenerPrestamoUseCase } from '../../application/use-cases/ObtenerPrestamoUseCase';
import { RegistrarPagoUseCase } from '../../application/use-cases/RegistrarPagoUseCase';
import { CancelarPrestamoUseCase } from '../../application/use-cases/CancelarPrestamoUseCase';
import { EditarPrestamoUseCase } from '../../application/use-cases/EditarPrestamoUseCase';

@injectable()
export class PrestamoController {
  constructor(
    @inject(CrearPrestamoUseCase) private readonly crearUseCase: CrearPrestamoUseCase,
    @inject(ListarPrestamosUseCase) private readonly listarUseCase: ListarPrestamosUseCase,
    @inject(ObtenerPrestamoUseCase) private readonly obtenerUseCase: ObtenerPrestamoUseCase,
    @inject(RegistrarPagoUseCase) private readonly registrarPagoUseCase: RegistrarPagoUseCase,
    @inject(CancelarPrestamoUseCase) private readonly cancelarUseCase: CancelarPrestamoUseCase,
    @inject(EditarPrestamoUseCase) private readonly editarUseCase: EditarPrestamoUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listarUseCase.execute({
        salonId: req.salonId!,
        estado: req.query.estado as string | undefined,
        usuarioId: req.query.usuarioId ? Number(req.query.usuarioId) : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 0,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.crearUseCase.execute({
        salonId: req.salonId!,
        usuarioId: req.body.usuarioId ?? null,
        nombreTercero: req.body.nombreTercero ?? null,
        monto: Number(req.body.monto),
        motivo: req.body.motivo,
        registradoPorId: req.user!.id,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.obtenerUseCase.execute(Number(req.params.id));
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.editarUseCase.execute({
        prestamoId: Number(req.params.id),
        motivo: req.body.motivo,
        monto: req.body.monto ? Number(req.body.monto) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  registrarPago = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registrarPagoUseCase.execute({
        prestamoId: Number(req.params.id),
        monto: Number(req.body.monto),
        observacion: req.body.observacion,
        tipoPago: 'MANUAL',
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  cancelar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cancelarUseCase.execute(Number(req.params.id));
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /** Listar préstamos activos de un empleado específico */
  prestamosPorEmpleado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listarUseCase.execute({
        salonId: req.salonId!,
        usuarioId: Number(req.params.usuarioId),
        estado: 'ACTIVO',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
