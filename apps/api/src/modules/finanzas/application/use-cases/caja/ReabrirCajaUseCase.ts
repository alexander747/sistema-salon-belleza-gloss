import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError, CajaYaAbiertaError } from '../../../../../shared/errors';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';

export interface ReabrirCajaInput {
  salonId: number;
}

/**
 * Reabre la caja del día comercial actual si ya fue cerrada (p. ej. cerrada para
 * almorzar y reabierta a la tarde). NO crea una fila nueva: se reabre la MISMA caja
 * (UNIQUE salonId+fechaCaja se preserva) y se limpian los datos del cierre intermedio:
 * el cierre final de fin de día los reemplaza.
 */
@injectable()
export class ReabrirCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: ReabrirCajaInput): Promise<CajaDTO> {
    const fechaCaja = getColombiaDateString();
    const caja = await this.cajaRepo.findBySalonYFecha(input.salonId, fechaCaja);

    if (!caja) {
      throw new CajaNoAbiertaError();
    }
    if (caja.estado !== 'CERRADA') {
      throw new CajaYaAbiertaError();
    }

    // UPDATE condicional: reabre SOLO si sigue CERRADA (guard atómico contra race)
    const reabierta = await this.cajaRepo.reabrir(caja.id);

    if (!reabierta) {
      // 0 filas afectadas → otra request ya reabrió la caja en el interín
      throw new CajaYaAbiertaError();
    }

    return cajaToDTO({
      ...caja,
      estado: 'ABIERTA',
      montoEsperado: null,
      montoRealEfectivo: null,
      diferencia: null,
      cierrePorId: null,
      cierreEn: null,
    });
  }
}
