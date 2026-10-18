/**
 * One PAYMENT received in the selected period, rendered as a row in the
 * "Cobros del período" sheet and used to reconcile the period's collected
 * income (same basis as the P&L "Cobrado" line).
 */
export interface PagoPeriodoDTO {
  /** Payment id (`pagos_transaccion.id`). */
  pagoId: number;
  /** Payment business date (YYYY-MM-DD Colombia): its caja date, legacy fallback. */
  fechaCobro: string;
  /** Sale id the payment belongs to (`registros_servicio.id`). */
  registroId: number;
  cliente: string;
  empleada: string;
  metodoPago: string;
  monto: number;
}
