import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { AbrirCajaUseCase } from '../../application/use-cases/caja/AbrirCajaUseCase';
import { CerrarCajaUseCase } from '../../application/use-cases/caja/CerrarCajaUseCase';
import { ObtenerCajaActualUseCase } from '../../application/use-cases/caja/ObtenerCajaActualUseCase';
import { ObtenerEsperadoCajaUseCase } from '../../application/use-cases/caja/ObtenerEsperadoCajaUseCase';
import { ListarCierresCajaUseCase } from '../../application/use-cases/caja/ListarCierresCajaUseCase';
import { paginationSchema } from '@pos-final/validation';
import type { EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

@injectable()
export class CajaController {
  constructor(
    @inject(AbrirCajaUseCase) private readonly abrirUseCase: AbrirCajaUseCase,
    @inject(CerrarCajaUseCase) private readonly cerrarUseCase: CerrarCajaUseCase,
    @inject(ObtenerCajaActualUseCase) private readonly actualUseCase: ObtenerCajaActualUseCase,
    @inject(ObtenerEsperadoCajaUseCase) private readonly esperadoUseCase: ObtenerEsperadoCajaUseCase,
    @inject(ListarCierresCajaUseCase) private readonly cierresUseCase: ListarCierresCajaUseCase,
  ) {}

  /** POST /salones/:salonId/caja/abrir — auditor = req.user?.id (null en n8n). */
  abrir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.abrirUseCase.execute({
        salonId: req.salonId!,
        montoInicial: req.body.montoInicial,
        aperturaPorId: req.user?.id ?? null,
      });
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** POST /salones/:salonId/caja/cerrar — auditor = req.user?.id (null en n8n). */
  cerrar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.cerrarUseCase.execute({
        salonId: req.salonId!,
        montoRealEfectivo: req.body.montoRealEfectivo,
        cierrePorId: req.user?.id ?? null,
      });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** GET /salones/:salonId/caja/actual */
  actual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.actualUseCase.execute({ salonId: req.salonId! });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** GET /salones/:salonId/caja/actual/esperado — preview read-only del arqueo. */
  actualEsperado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.esperadoUseCase.execute({ salonId: req.salonId! });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** GET /salones/:salonId/caja/cierres?page=&limit=&estado= */
  cierres = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pag = paginationSchema.safeParse(req.query);
      const page = pag.success ? pag.data.page : 1;
      const limit = pag.success ? pag.data.limit : 0;
      const estadoParam = req.query.estado as string | undefined;
      const estado: EstadoCaja | undefined =
        estadoParam === 'ABIERTA' || estadoParam === 'CERRADA' ? estadoParam : undefined;

      const result = await this.cierresUseCase.execute({ salonId: req.salonId!, page, limit, estado });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
