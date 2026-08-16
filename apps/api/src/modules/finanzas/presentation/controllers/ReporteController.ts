import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Rol } from '@pos-final/types';
import { ResumenDiaUseCase, type ResumenDiaInput } from '../../application/use-cases/reporte/ResumenDiaUseCase';
import { ROIMensualUseCase } from '../../application/use-cases/reporte/ROIMensualUseCase';
import { CierreTurnoUseCase } from '../../application/use-cases/reporte/CierreTurnoUseCase';
import { PyLMensualUseCase } from '../../application/use-cases/reporte/PyLMensualUseCase';
import { ExcelExportService } from '../../application/services/ExcelExportService';
import { ValidationError } from '../../../../shared/errors';
import { getColombiaDateString } from '../../../../shared/colombia-date';

// Same role rule as RegistroController.list: only privileged roles can filter
// the resumen by empleada/cliente; restricted roles see only their own records.
const REGISTROS_PRIVILEGED_ROLES = new Set<number>([
  Rol.SUPERADMIN,
  Rol.DUEÑA,
  Rol.ADMINISTRADOR,
  Rol.CONTADOR,
]);

const TIPO_FILTER_VALUES = ['TODOS', 'SERVICIOS', 'PRODUCTOS'] as const;

// Validación inline (sin tocar @pos-final/validation — evita el rebuild de dist).
// desde/hasta son fechas Colombia YYYY-MM-DD; usuarioId es un entero positivo.
const PYL_QUERY_SCHEMA = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
});

@injectable()
export class ReporteController {
  constructor(
    @inject(ResumenDiaUseCase) private readonly resumenDiaUseCase: ResumenDiaUseCase,
    @inject(ROIMensualUseCase) private readonly roiMensualUseCase: ROIMensualUseCase,
    @inject(CierreTurnoUseCase) private readonly cierreTurnoUseCase: CierreTurnoUseCase,
    @inject(PyLMensualUseCase) private readonly pylMensualUseCase: PyLMensualUseCase,
    @inject(ExcelExportService) private readonly excelExportService: ExcelExportService,
  ) {}

  resumenDia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const desde = req.query.desde as string | undefined;
      const hasta = req.query.hasta as string | undefined;
      const fecha = req.query.fecha as string | undefined;

      // Same role rule as RegistroController.list: restricted roles are forced
      // to their own usuarioId and can never filter by clienteId.
      const isPrivileged = req.user ? REGISTROS_PRIVILEGED_ROLES.has(req.user.rol) : false;
      const usuarioId = isPrivileged
        ? req.query.usuarioId ? Number(req.query.usuarioId) : undefined
        : req.user!.id;
      const clienteId = isPrivileged
        ? req.query.clienteId ? Number(req.query.clienteId) : undefined
        : undefined;

      // tipo is validated; invalid values fall back to TODOS (existing behavior).
      const rawTipo = req.query.tipo;
      const tipo = (TIPO_FILTER_VALUES as readonly string[]).includes(rawTipo as string)
        ? (rawTipo as ResumenDiaInput['tipo'])
        : 'TODOS';

      const result = await this.resumenDiaUseCase.execute({
        salonId: req.salonId!,
        ...(desde && hasta ? { desde, hasta } : { fecha: fecha ?? getColombiaDateString() }),
        ...(usuarioId !== undefined ? { usuarioId } : {}),
        ...(clienteId !== undefined ? { clienteId } : {}),
        ...(tipo !== 'TODOS' ? { tipo } : {}),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  roiMensual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mes = req.query.mes
        ? new Date(req.query.mes as string + '-01')
        : new Date();

      const result = await this.roiMensualUseCase.execute({
        salonId: req.salonId!,
        mes,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  cierreTurno = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = Number(req.params.id);
      const fecha = req.query.fecha
        ? new Date(req.query.fecha as string)
        : new Date();

      const result = await this.cierreTurnoUseCase.execute({
        salonId: req.salonId!,
        usuarioId,
        fecha,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  pyl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = PYL_QUERY_SCHEMA.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Parámetros inválidos', parsed.error.flatten().fieldErrors);
      }

      // Misma regla de roles que resumenDia: roles privilegiados pueden filtrar
      // por empleada; roles restringidos son forzados a su propio usuarioId.
      const isPrivileged = req.user ? REGISTROS_PRIVILEGED_ROLES.has(req.user.rol) : false;
      const usuarioId = isPrivileged ? parsed.data.usuarioId : req.user!.id;

      const result = await this.pylMensualUseCase.execute({
        salonId: req.salonId!,
        ...(parsed.data.desde ? { desde: parsed.data.desde } : {}),
        ...(parsed.data.hasta ? { hasta: parsed.data.hasta } : {}),
        ...(usuarioId !== undefined ? { usuarioId } : {}),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  exportar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = PYL_QUERY_SCHEMA.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Parámetros inválidos', parsed.error.flatten().fieldErrors);
      }

      // Misma regla de roles que pyl: privilegiados pueden filtrar por empleada;
      // roles restringidos son forzados a su propio usuarioId.
      const isPrivileged = req.user ? REGISTROS_PRIVILEGED_ROLES.has(req.user.rol) : false;
      const usuarioId = isPrivileged ? parsed.data.usuarioId : req.user!.id;

      const { buffer, filename } = await this.excelExportService.exportar({
        salonId: req.salonId!,
        ...(parsed.data.desde ? { desde: parsed.data.desde } : {}),
        ...(parsed.data.hasta ? { hasta: parsed.data.hasta } : {}),
        ...(usuarioId !== undefined ? { usuarioId } : {}),
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
