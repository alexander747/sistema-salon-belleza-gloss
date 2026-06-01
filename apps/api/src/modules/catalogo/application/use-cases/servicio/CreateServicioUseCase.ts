import { injectable, inject } from 'tsyringe';
import type { IServicioRepository } from '../../../domain/ports/IServicioRepository';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import { ServicioDTO } from '../../dtos/ServicioDTO';
import { ValidationError } from '../../../../../shared/errors';
import type { SalonEntity } from '../../../../../infrastructure/persistence/entities/SalonEntity';
import type { ISalonRepository } from '../../../../../modules/salon/domain/ports/ISalonRepository';

interface CreateServicioInput {
  salonId: number;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  duracionMinutos?: number;
  categoriaId: number;
}

interface ReglaTemporada {
  fechaInicio: string;
  fechaFin: string;
  multiplicador: number;
}

@injectable()
export class CreateServicioUseCase {
  constructor(
    @inject('IServicioRepository') private readonly servicioRepo: IServicioRepository,
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(input: CreateServicioInput): Promise<ServicioDTO> {
    // Validate categoria exists and belongs to the same salon
    const categoria = await this.categoriaRepo.findBySalonAndId(input.salonId, input.categoriaId);
    if (!categoria) {
      throw new ValidationError('La categoría especificada no existe o no pertenece a este salón');
    }

    const servicio = await this.servicioRepo.create({
      nombre: input.nombre,
      descripcion: input.descripcion ?? undefined,
      precioBase: input.precioBase,
      duracionMinutos: input.duracionMinutos ?? 60,
      categoriaId: input.categoriaId,
      activo: true,
    });

    // Compute precioFinal for response
    const salon = await this.salonRepo.findById(input.salonId);
    const precioFinal = this.computePrecioFinal(servicio.precioBase, salon);

    return ServicioDTO.fromEntity(servicio, precioFinal);
  }

  private computePrecioFinal(precioBase: number, salon: SalonEntity | null): number {
    if (!salon?.reglasTemporada) return Number(precioBase);

    const reglas = salon.reglasTemporada as ReglaTemporada | ReglaTemporada[];
    const reglasArray = Array.isArray(reglas) ? reglas : [reglas];
    const now = new Date();

    for (const regla of reglasArray) {
      const inicio = new Date(regla.fechaInicio);
      const fin = new Date(regla.fechaFin);
      if (now >= inicio && now <= fin) {
        return Number(precioBase) * regla.multiplicador;
      }
    }

    return Number(precioBase);
  }
}
