import type { PagoPrestamoEntity } from '../../../../infrastructure/persistence/entities/PagoPrestamoEntity';

export interface IPagoPrestamoRepository {
  findByPrestamo(prestamoId: number): Promise<PagoPrestamoEntity[]>;
  /** Pagos ligados a una caja (cobros MANUAL: INGRESOS del arqueo). */
  findByCajaId(cajaId: number): Promise<PagoPrestamoEntity[]>;
  /**
   * Σ monto de pagos MANUAL del salón en [fechaInicio, fechaFin) por creadoEn —
   * INGRESO cash-basis para el P&L ("Préstamos" = cuentas por cobrar que el
   * deudor devuelve). Incluye TODOS los métodos: una transferencia no toca el
   * cajón pero sí es ingreso. Excluye los tipoPago=LIQUIDACION (ya van netos
   * dentro de totalPagado de la liquidación).
   */
  sumManualBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number>;
  create(data: Partial<PagoPrestamoEntity>): Promise<PagoPrestamoEntity>;
}
