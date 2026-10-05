import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { IPagoTransaccionRepository } from '../../../domain/ports/IPagoTransaccionRepository';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { ILiquidacionRepository } from '../../../domain/ports/ILiquidacionRepository';
import type { IPagoPrestamoRepository } from '../../../../prestamos/domain/ports/IPagoPrestamoRepository';
import { NotFoundError } from '../../../../../shared/errors';
import { calcularReporteCierre, type MetodoPagoCaja, type ReporteCierre } from './calcularReporteCierre';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';
import { EstadoRegistro } from '../../../../../infrastructure/persistence/entities/RegistroServicioEntity';

export interface ObtenerDetalleCierreCajaInput {
  salonId: number;
  cajaId: number;
}

export interface DetalleCierreMovimiento {
  id: number;
  tipo: 'SERVICIO' | 'GASTO';
  fecha: Date;
  descripcion: string;
  monto: number;
  metodoPago: MetodoPagoCaja | null;
}

export interface ObtenerDetalleCierreCajaResult {
  caja: CajaDTO;
  reporte: ReporteCierre;
  movimientos: DetalleCierreMovimiento[];
}

/**
 * Detalle read-only de un cierre de caja (historial): arma la lista de
 * movimientos y el reporte informativo.
 *
 * Consistencia de cierres: si la caja está CERRADA, el arqueo (montoEsperado,
 * montoReal, diferencia) se toma de los valores PERSISTIDOS del cierre, no de un
 * recálculo vivo. Borrar/backfillear un gasto o devolución después de cerrar no
 * debe mover el arqueo histórico ni hacer que el detalle discrepe del cierre
 * guardado. Para una caja ABIERTA sí se recomputa en vivo (preview).
 */
@injectable()
export class ObtenerDetalleCierreCajaUseCase {
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

  async execute(input: ObtenerDetalleCierreCajaInput): Promise<ObtenerDetalleCierreCajaResult> {
    const caja = await this.cajaRepo.findById(input.cajaId);

    if (!caja || caja.salonId !== input.salonId) {
      throw new NotFoundError('Caja no encontrada');
    }

    const [registros, gastos, pagosDeLaCaja, devoluciones, pagosPrestamo, liquidaciones] =
      await Promise.all([
        this.registroRepo.search({ salonId: input.salonId, cajaId: caja.id }),
        this.gastoRepo.findByCajaId(caja.id),
        // Arqueo por caja: pagos recibidos en ESTA caja (abonos incluidos)
        this.pagoRepo.findByCajaConFallback(caja.id),
        this.devolucionRepo.findByCajaId(caja.id),
        this.pagoPrestamoRepo.findByCajaId(caja.id),
        this.liquidacionRepo.findByCajaId(caja.id),
      ]);

    // Caja ABIERTA → montoRealEfectivo null (aún no hay arqueo): pasar null en vez
    // de Number(null)=0 para no fabricar un arqueo falso (mismo patrón que el preview).
    const montoRealEfectivo = caja.montoRealEfectivo === null ? null : Number(caja.montoRealEfectivo);

    // Cobros de préstamo MANUAL: INFLOW (cuenta por cobrar que el deudor
    // devuelve). Solo EFECTIVO mueve el arqueo; transferencia solo se reporta.
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
      montoRealEfectivo,
      Number(caja.montoInicial),
      [...pagosDeLaCaja, ...cobrosPrestamo],
      egresos,
    );

    // Caja CERRADA: el detalle debe reflejar los números PERSISTIDOS del cierre.
    // El recálculo de arriba usa datos vivos (gastos/devoluciones/egresos) y
    // divergiría si algo se borra/backfillea después de cerrar.
    if (caja.estado === 'CERRADA') {
      reporte.montoEsperado = Number(caja.montoEsperado ?? reporte.montoEsperado);
      reporte.montoReal = montoRealEfectivo;
      reporte.diferencia = caja.diferencia === null ? null : Number(caja.diferencia);

      // Si el cierre persistió el desglose recaudado por método, usarlo para que
      // el detalle histórico coincida con el cierre guardado. Filas legacy (sin
      // desglose) conservan el recálculo vivo de arriba.
      if (caja.montoRecaudado != null) {
        reporte.porMetodoPago = {
          EFECTIVO: Number(caja.montoEfectivo ?? 0),
          TARJETA: Number(caja.montoTarjeta ?? 0),
          TRANSFERENCIA: Number(caja.montoTransferencia ?? 0),
        };
        reporte.totalRecaudado = Number(caja.montoRecaudado);
      }

      // Origen del ingreso por tipo persistido al cerrar (si existe). Filas legacy
      // (sin desglose) conservan el recálculo vivo de arriba.
      if (caja.montoServicios != null || caja.montoProductos != null) {
        reporte.ingresosServicios = Number(caja.montoServicios ?? 0);
        reporte.ingresosProductos = Number(caja.montoProductos ?? 0);
      }
    }

    // Movimientos: registros ACTIVOS como SERVICIO + gastos como GASTO.
    // Se excluyen ANULADOS para que movimientos.length === reporte.cantidadMovimientos.
    const movimientos: DetalleCierreMovimiento[] = [
      ...registros
        .filter((r) => r.estado !== EstadoRegistro.ANULADO)
        .map((r) => ({
          id: r.id,
          tipo: 'SERVICIO' as const,
          // Fecha de negocio del movimiento (backfill); legacy -> creadoEn
          fecha: r.fechaHora ?? r.creadoEn,
          descripcion:
            r.serviciosItems?.map((si) => si.nombreServicio).join(', ') || `Registro #${r.id}`,
          monto: Number(r.montoTotal),
          metodoPago: (r.pagos?.[0]?.metodoPago as MetodoPagoCaja) ?? null,
        })),
      ...gastos.map((g) => ({
        id: g.id,
        tipo: 'GASTO' as const,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        metodoPago: (g.metodoPago as MetodoPagoCaja) ?? null,
      })),
    ];

    return { caja: cajaToDTO(caja), reporte, movimientos };
  }
}
