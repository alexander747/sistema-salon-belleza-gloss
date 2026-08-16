import type { ICajaRepository } from '../../domain/ports/ICajaRepository';
import type { CajaEntity } from '../../../../infrastructure/persistence/entities/CajaEntity';
import { getColombiaDateString } from '../../../../shared/colombia-date';
import { CajaCerradaError } from '../../../../shared/errors';

/**
 * Guard compartido (regla de oro): verifica que exista una caja ABIERTA para
 * el salón el día comercial de Colombia. Lanza CajaCerradaError (422) si no.
 * Se inyecta en los chokepoints de venta (CreateRegistro, completar cita).
 */
export async function verificarCajaAbierta(
  cajaRepo: ICajaRepository,
  salonId: number,
): Promise<CajaEntity> {
  const caja = await cajaRepo.findAbiertaBySalonYFecha(salonId, getColombiaDateString());
  if (!caja) {
    throw new CajaCerradaError('No hay caja abierta para el salón. Abrí la caja antes de vender.');
  }
  return caja;
}
