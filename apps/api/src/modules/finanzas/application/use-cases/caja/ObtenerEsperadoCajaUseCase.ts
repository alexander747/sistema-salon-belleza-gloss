import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IPagoPrestamoRepository } from '../../../../prestamos/domain/ports/IPagoPrestamoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError } from '../../../../../shared/errors';
import { calcularReporteCierre, type ReporteCierre } from './calcularReporteCierre';

export interface ObtenerEsperadoCajaInput {
  salonId: number;
}

@injectable()
export class ObtenerEsperadoCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
    @inject('IPagoTransaccionRepository')
    private readonly pagoRepo: IPagoTransaccionRepository,
    @inject('IDevolucionRepository')
    private readonly devolucionRepo: IDevolucionRepository,
    @inject('IPagoPrestamoRepository')
    private readonly pagoPrestamoRepo: IPagoPrestamoRepository,
    @inject('ILiquidacionRepository')
    private readonly liquidacionRepo: ILiquidacionRepository,
  ) {}

  /**
   * Preview del arqueo (read-only): mismo cálculo que el cierre pero sin persistir.
   * `montoRealEfectivo = null` → `diferencia` null en la respuesta.
   */
  async execute(input: ObtenerEsperadoCajaInput): Promise<ReporteCierre> {
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(input.salonId, getColombiaDateString());
    if (!caja) {
      throw new CajaNoAbiertaError();
    }

    const [registros, gastos, pagosDeLaCaja, devoluciones, pagosPrestamo, liquidaciones] =
      await Promise.all([
        this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
        this.gastoRepo.findByCajaId(caja.id),
        // Arqueo por caja: pagos recibidos en ESTA caja (incluye abonos de hoy)
        this.pagoRepo.findByCajaConFallback(caja.id),
        this.devolucionRepo.findByCajaId(caja.id),
        this.pagoPrestamoRepo.findByCajaId(caja.id),
        this.liquidacionRepo.findByCajaId(caja.id),
      ]);

    // Cobros de préstamo MANUAL: INFLOW (cuenta por cobrar que el deudor
    // devuelve). Solo EFECTIVO mueve el arqueo; transferencia solo se reporta.
    const cobrosPrestamo = pagosPrestamo
      .filter((p) => p.tipoPago === 'MANUAL')
      .map((p) => ({ monto: Number(p.monto), metodoPago: p.metodoPago }));

    const egresos = [
      ...devoluciones.map((d) => ({ monto: Number(d.montoDevolucion), metodoPago: d.metodoPago })),
      ...liquidaciones.map((l) => ({ monto: Number(l.totalPagado), metodoPago: l.metodoPago })),
    ];

    return calcularReporteCierre(
      registros,
      gastos,
      null,
      Number(caja.montoInicial),
      [...pagosDeLaCaja, ...cobrosPrestamo],
      egresos,
    );
  }
}
