import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { DisponibilidadService } from '../../application/services/DisponibilidadService';
import { ValidationError } from '../../../../shared/errors';
import { disponibilidadQuerySchema } from '@pos-final/validation';

@injectable()
export class DisponibilidadController {
  constructor(
    @inject(DisponibilidadService) private readonly disponibilidadService: DisponibilidadService,
  ) {}

  verificar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = disponibilidadQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Parámetros inválidos', parsed.error.flatten().fieldErrors);
      }

      const { usuarioId, fecha, hora, duracionMinutos } = parsed.data;
      if (!hora) {
        throw new ValidationError('La hora es requerida para verificar disponibilidad');
      }
      const fechaInicio = new Date(`${fecha}T${hora}:00`);

      const result = await this.disponibilidadService.verificar(
        req.salonId!,
        usuarioId,
        fechaInicio,
        duracionMinutos,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  obtenerSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = disponibilidadQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Parámetros inválidos', parsed.error.flatten().fieldErrors);
      }

      const { usuarioId, fecha, duracionMinutos } = parsed.data;
      const fechaDate = new Date(`${fecha}T00:00:00`);

      const result = await this.disponibilidadService.obtenerSlots(
        req.salonId!,
        usuarioId,
        fechaDate,
        duracionMinutos,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
