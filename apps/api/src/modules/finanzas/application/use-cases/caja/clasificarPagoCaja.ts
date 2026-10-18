import { getColombiaDateString } from '../../../../../shared/colombia-date';
import type {
  MetodoPagoCaja,
  OrigenPagoCaja,
  PagoExtraCajaInput,
} from './calcularReporteCierre';

/** Structural payment shape (compatible with PagoTransaccionEntity). */
export interface PagoCajaConRegistro {
  monto: number | string;
  metodoPago: MetodoPagoCaja;
  registroServicio?: {
    fechaHora?: Date | string | null;
    creadoEn?: Date | string | null;
  } | null;
}

/**
 * Classifies an inflow received in a caja by its origin.
 *
 * The payment's business date is the caja's date (that is why it was returned
 * by `findByCajaConFallback`). The SALE's business date is
 * `COALESCE(registro.fechaHora, registro.creadoEn)` — exactly the same
 * boundaries used by `sumCobrosDeudaAnterior` — so a sale dated strictly
 * before the caja's date is an old-debt abono. ANULADO records are already
 * excluded by the payment repository.
 *
 * Missing relations (legacy/mocked rows) fall back to VENTA_DIA instead of
 * guessing; this keeps `cobrosVentasDia + cobrosDeudaAnteriorDia +
 * cobrosPrestamoDia = totalRecaudado` exact.
 */
export function clasificarPagoCaja(
  pago: PagoCajaConRegistro,
  fechaCaja: string,
): PagoExtraCajaInput {
  const registro = pago.registroServicio ?? null;
  const fechaRegistro = registro?.fechaHora ?? registro?.creadoEn ?? null;

  let origen: OrigenPagoCaja = 'VENTA_DIA';
  if (fechaRegistro != null) {
    const fecha = fechaRegistro instanceof Date ? fechaRegistro : new Date(fechaRegistro);
    if (!Number.isNaN(fecha.getTime()) && getColombiaDateString(fecha) < fechaCaja) {
      origen = 'DEUDA_ANTERIOR';
    }
  }

  return {
    monto: Number(pago.monto),
    metodoPago: pago.metodoPago,
    origen,
  };
}
