import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { AbrirCajaUseCase } from '../../application/use-cases/caja/AbrirCajaUseCase';
import { CerrarCajaUseCase } from '../../application/use-cases/caja/CerrarCajaUseCase';
import { ReabrirCajaUseCase } from '../../application/use-cases/caja/ReabrirCajaUseCase';
import { ObtenerCajaActualUseCase } from '../../application/use-cases/caja/ObtenerCajaActualUseCase';
import { ObtenerEsperadoCajaUseCase } from '../../application/use-cases/caja/ObtenerEsperadoCajaUseCase';
import { ListarCierresCajaUseCase } from '../../application/use-cases/caja/ListarCierresCajaUseCase';
import { ObtenerDetalleCierreCajaUseCase } from '../../application/use-cases/caja/ObtenerDetalleCierreCajaUseCase';
import { paginationSchema } from '@pos-final/validation';
import type { EstadoCaja } from '../../../../infrastructure/persistence/entities/CajaEntity';

@injectable()
export class CajaController {
  constructor(
    @inject(AbrirCajaUseCase) private readonly abrirUseCase: AbrirCajaUseCase,
    @inject(CerrarCajaUseCase) private readonly cerrarUseCase: CerrarCajaUseCase,
    @inject(ReabrirCajaUseCase) private readonly reabrirUseCase: ReabrirCajaUseCase,
    @inject(ObtenerCajaActualUseCase) private readonly actualUseCase: ObtenerCajaActualUseCase,
    @inject(ObtenerEsperadoCajaUseCase) private readonly esperadoUseCase: ObtenerEsperadoCajaUseCase,
    @inject(ListarCierresCajaUseCase) private readonly cierresUseCase: ListarCierresCajaUseCase,
    @inject(ObtenerDetalleCierreCajaUseCase) private readonly detalleUseCase: ObtenerDetalleCierreCajaUseCase,
  ) {}

  /** POST /salones/:salonId/caja/abrir — auditor = req.user?.id (null en n8n). */
  abrir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.abrirUseCase.execute({
        salonId: req.salonId!,
        montoInicial: req.body.montoInicial,
        aperturaPorId: req.user?.id ?? null,
        // fechaCaja opcional (backfill): ausente → hoy Colombia en el use case
        ...(req.body.fechaCaja !== undefined ? { fechaCaja: req.body.fechaCaja } : {}),
      });
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** POST /salones/:salonId/caja/cerrar — auditor = req.user?.id (null en n8n). */
  cerrar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // cajaId opcional: body (validado por cerrarCajaSchema) con fallback a query.
      const cajaIdRaw = req.body.cajaId ?? req.query?.cajaId;
      const cajaId = cajaIdRaw != null ? Number(cajaIdRaw) : undefined;

      const result = await this.cerrarUseCase.execute({
        salonId: req.salonId!,
        montoRealEfectivo: req.body.montoRealEfectivo,
        cierrePorId: req.user?.id ?? null,
        ...(cajaId !== undefined ? { cajaId } : {}),
      });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /** POST /salones/:salonId/caja/reabrir — reabre una caja CERRADA (misma fila).
   *  fechaCaja opcional (YYYY-MM-DD): default hoy (flujo legacy). */
  reabrir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fechaCaja =
        (req.body?.fechaCaja as string | undefined) ??
        (req.query?.fechaCaja as string | undefined);
      const result = await this.reabrirUseCase.execute({
        salonId: req.salonId!,
        ...(fechaCaja ? { fechaCaja } : {}),
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

  /** GET /salones/:salonId/caja/:id/cierre — detalle read-only de un cierre (historial). */
  detalleCierre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.detalleUseCase.execute({
        salonId: req.salonId!,
        cajaId: Number(req.params.id),
      });
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
