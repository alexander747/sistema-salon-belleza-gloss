import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import { getColombiaDateString } from '../../../../../shared/colombia-date';
import { CajaNoAbiertaError } from '../../../../../shared/errors';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';

export interface ObtenerCajaActualInput {
  salonId: number;
}

@injectable()
export class ObtenerCajaActualUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: ObtenerCajaActualInput): Promise<CajaDTO> {
    const caja = await this.cajaRepo.findAbiertaBySalonYFecha(input.salonId, getColombiaDateString());
    if (!caja) {
      throw new CajaNoAbiertaError();
    }
    return cajaToDTO(caja);
  }
}
