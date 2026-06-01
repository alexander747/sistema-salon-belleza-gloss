import { injectable, inject } from 'tsyringe';
import type { IServicioRepository } from '../../../domain/ports/IServicioRepository';
import type { ISalonRepository } from '../../../../../modules/salon/domain/ports/ISalonRepository';
import type { SalonEntity } from '../../../../../infrastructure/persistence/entities/SalonEntity';
import { ServicioDTO } from '../../dtos/ServicioDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface GetServicioInput {
  salonId: number;
  id: number;
}

interface ReglaTemporada {
  fechaInicio: string;
  fechaFin: string;
  multiplicador: number;
}

@injectable()
export class GetServicioUseCase {
  constructor(
    @inject('IServicioRepository') private readonly servicioRepo: IServicioRepository,
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(input: GetServicioInput): Promise<ServicioDTO> {
    const servicio = await this.servicioRepo.findBySalonAndId(input.salonId, input.id);
    if (!servicio) {
      throw new NotFoundError('Servicio no encontrado');
    }

    const salon = await this.salonRepo.findById(input.salonId);
    const multiplicador = this.getActiveMultiplicador(salon);
    const precioFinal = multiplicador
      ? Number(servicio.precioBase) * multiplicador
      : Number(servicio.precioBase);

    const fotosCount = await this.servicioRepo.countFotos(input.id);

    return ServicioDTO.fromEntity(servicio, precioFinal, fotosCount);
  }

  private getActiveMultiplicador(salon: SalonEntity | null): number | null {
    if (!salon?.reglasTemporada) return null;

    const reglas = salon.reglasTemporada as ReglaTemporada | ReglaTemporada[];
    const reglasArray = Array.isArray(reglas) ? reglas : [reglas];
    const now = new Date();

    for (const regla of reglasArray) {
      const inicio = new Date(regla.fechaInicio);
      const fin = new Date(regla.fechaFin);
      if (now >= inicio && now <= fin) {
        return regla.multiplicador;
      }
    }

    return null;
  }
}
