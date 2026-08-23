import type { ICajaRepository } from '../../domain/ports/ICajaRepository';
import type { CajaEntity } from '../../../../infrastructure/persistence/entities/CajaEntity';
import { getColombiaDateString } from '../../../../shared/colombia-date';
import { CajaCerradaError, CajaNoAbiertaEnFechaError } from '../../../../shared/errors';

/**
 * Guard compartido (regla de oro): verifica que exista una caja ABIERTA para
 * el salón el día comercial de Colombia.
 *
 * - Sin `fecha` (default = hoy): conserva el comportamiento legacy → lanza
 *   `CajaCerradaError` (422 CAJA_CERRADA) si no hay caja.
 * - Con `fecha` explícita (backfill): resuelve la caja de ESA fecha; si la
 *   fecha ≠ hoy y no hay caja ABIERTA → `CajaNoAbiertaEnFechaError`
 *   (409 CAJA_NO_ABIERTA_EN_FECHA). Si la fecha explícita ES hoy, el camino
 *   de hoy (422) se mantiene intacto.
 */
export async function verificarCajaAbierta(
  cajaRepo: ICajaRepository,
  salonId: number,
  fecha: string = getColombiaDateString(),
): Promise<CajaEntity> {
  const caja = await cajaRepo.findAbiertaBySalonYFecha(salonId, fecha);
  if (!caja) {
    if (fecha === getColombiaDateString()) {
      throw new CajaCerradaError('No hay caja abierta para el salón. Abrí la caja antes de vender.');
    }
    throw new CajaNoAbiertaEnFechaError(
      `No hay caja abierta para la fecha ${fecha} — abrí la caja de esa fecha antes de registrar la venta`,
    );
  }
  return caja;
}
