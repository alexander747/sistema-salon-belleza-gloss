import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IPagoPrestamoRepository } from '../../../../prestamos/domain/ports/IPagoPrestamoRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError, CajaNoEncontradaError, CajaYaCerradaError } from '../../../../../shared/errors';
import { calcularReporteCierre } from './calcularReporteCierre';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';
import type { ReporteCierreDTO } from '../../dtos/ReporteCierreDTO';
import type { CajaEntity } from '../../../../../infrastructure/persistence/entities/CajaEntity';

export interface CerrarCajaInput {
  salonId: number;
  montoRealEfectivo: number;
  /** Opcional: cierra ESA caja (huérfana de otro día). Sin él → cierra la de hoy. */
  cajaId?: number;
  cierrePorId?: number | null;
}

@injectable()
export class CerrarCajaUseCase {
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

  async execute(input: CerrarCajaInput): Promise<ReporteCierreDTO> {
    const caja = input.cajaId
      ? await this.cajaPorId(input.salonId, input.cajaId)
      : await this.cajaDeHoy(input.salonId);

    const [registros, gastos, pagosDeLaCaja, devoluciones, pagosPrestamo, liquidaciones] =
      await Promise.all([
        this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
        this.gastoRepo.findByCajaId(caja.id),
        // Arqueo por caja: todos los pagos recibidos en ESTA caja (pago.cajaId = C,
        // incluye abonos de hoy sobre registros de otra caja; legacy → registro.cajaId)
        this.pagoRepo.findByCajaConFallback(caja.id),
        // Rule B: devoluciones ligadas a la caja (solo EFECTIVO restan del cajón).
        this.devolucionRepo.findByCajaId(caja.id),
        // Rule C (corregido): los préstamos son cuentas por COBRAR — el cobro
        // MANUAL del deudor ENTRA al cajón y suma al arqueo. Los
        // tipoPago=LIQUIDACION ya van netos dentro de totalPagado de la liquidación.
        this.pagoPrestamoRepo.findByCajaId(caja.id),
        // Rule C: nómina pagada en efectivo desde esta caja.
        this.liquidacionRepo.findByCajaId(caja.id),
      ]);

    // Cobros de préstamo MANUAL: INFLOW. Solo su parte EFECTIVO mueve el
    // esperado (una transferencia se reporta en el breakdown pero no toca el cajón).
    const cobrosPrestamo = pagosPrestamo
      .filter((p) => p.tipoPago === 'MANUAL')
      .map((p) => ({ monto: Number(p.monto), metodoPago: p.metodoPago }));

    const egresos = [
      ...devoluciones.map((d) => ({ monto: Number(d.montoDevolucion), metodoPago: d.metodoPago })),
      ...liquidaciones.map((l) => ({ monto: Number(l.totalPagado), metodoPago: l.metodoPago })),
    ];

    const reporte = calcularReporteCierre(
      registros,
      gastos,
      input.montoRealEfectivo,
      Number(caja.montoInicial),
      [...pagosDeLaCaja, ...cobrosPrestamo],
      egresos,
    );

    // UPDATE condicional: guard atómico contra doble cierre (race)
    const cerrado = await this.cajaRepo.cerrar(caja.id, {
      montoEsperado: reporte.montoEsperado,
      montoRealEfectivo: input.montoRealEfectivo,
      diferencia: reporte.diferencia ?? 0,
      cierrePorId: input.cierrePorId ?? null,
    });

    if (!cerrado) {
      // 0 filas afectadas → otra request ya cerró la caja
      throw new CajaYaCerradaError();
    }

    const cajaCerrada: CajaDTO = {
      ...cajaToDTO(caja),
      estado: 'CERRADA',
      montoEsperado: reporte.montoEsperado,
      montoRealEfectivo: input.montoRealEfectivo,
      diferencia: reporte.diferencia ?? 0,
      cierrePorId: input.cierrePorId ?? null,
      cierreEn: new Date(),
    };

    return { caja: cajaCerrada, reporte };
  }

  /** Cierra ESA caja por id: debe existir, ser del salón y estar ABIERTA. */
  private async cajaPorId(salonId: number, cajaId: number): Promise<CajaEntity> {
    const caja = await this.cajaRepo.findById(cajaId);

    if (!caja || caja.salonId !== salonId) {
      throw new CajaNoEncontradaError();
    }
    if (caja.estado !== 'ABIERTA') {
      throw new CajaYaCerradaError();
    }
    return caja;
  }

  /** Fallback sin cajaId: la caja ABIERTA del día comercial actual. */
  private async cajaDeHoy(salonId: number): Promise<CajaEntity> {
    const fechaCaja = getColombiaDateString();
    const caja = await this.cajaRepo.findBySalonYFecha(salonId, fechaCaja);

    if (!caja) {
      throw new CajaNoAbiertaError();
    }
    if (caja.estado !== 'ABIERTA') {
      throw new CajaYaCerradaError();
    }
    return caja;
  }
}
