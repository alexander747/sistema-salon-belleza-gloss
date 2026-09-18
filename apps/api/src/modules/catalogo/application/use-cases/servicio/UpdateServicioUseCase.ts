import { injectable, inject } from 'tsyringe';
import type { IServicioRepository } from '../../../domain/ports/IServicioRepository';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import type { ISalonRepository } from '../../../../../modules/salon/domain/ports/ISalonRepository';
import { ServicioDTO } from '../../dtos/ServicioDTO';
import { NotFoundError, UnprocessableEntityError, ValidationError } from '../../../../../shared/errors';
import type { SalonEntity } from '../../../../../infrastructure/persistence/entities/SalonEntity';
import type { TipoCostoInsumo } from '../../../../../infrastructure/persistence/entities/ServicioEntity';

interface UpdateServicioInput {
  salonId: number;
  id: number;
  nombre?: string;
  descripcion?: string;
  precioBase?: number;
  duracionMinutos?: number;
  categoriaId?: number;
  costoBaseInsumos?: number;
  tipoCostoInsumo?: TipoCostoInsumo;
  precioPorGramo?: number | null;
}

interface ReglaTemporada {
  fechaInicio: string;
  fechaFin: string;
  multiplicador: number;
}

@injectable()
export class UpdateServicioUseCase {
  constructor(
    @inject('IServicioRepository') private readonly servicioRepo: IServicioRepository,
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(input: UpdateServicioInput): Promise<ServicioDTO> {
    const servicio = await this.servicioRepo.findBySalonAndId(input.salonId, input.id);
    if (!servicio) {
      throw new NotFoundError('Servicio no encontrado');
    }

    // If changing categoria, validate it belongs to the same salon
    if (input.categoriaId !== undefined && input.categoriaId !== servicio.categoriaId) {
      const categoria = await this.categoriaRepo.findBySalonAndId(input.salonId, input.categoriaId);
      if (!categoria) {
        throw new ValidationError('La categoría especificada no existe o no pertenece a este salón');
      }
    }

    // Cost-mode rule: partial updates can flip POR_GRAMO without re-sending
    // the price, so validate the RESULTING state, not just the payload.
    const nextTipoCosto: TipoCostoInsumo = input.tipoCostoInsumo ?? servicio.tipoCostoInsumo ?? 'FIJO';
    const nextPrecioPorGramo =
      input.precioPorGramo !== undefined ? input.precioPorGramo : servicio.precioPorGramo;
    if (nextTipoCosto === 'POR_GRAMO' && !(nextPrecioPorGramo && Number(nextPrecioPorGramo) > 0)) {
      throw new UnprocessableEntityError(
        'El precio por gramo debe ser mayor a 0 cuando el tipo de costo es POR_GRAMO',
      );
    }

    const data: Record<string, unknown> = {};
    if (input.nombre !== undefined) data.nombre = input.nombre;
    if (input.descripcion !== undefined) data.descripcion = input.descripcion;
    if (input.precioBase !== undefined) data.precioBase = input.precioBase;
    if (input.duracionMinutos !== undefined) data.duracionMinutos = input.duracionMinutos;
    if (input.categoriaId !== undefined) data.categoriaId = input.categoriaId;
    if (input.costoBaseInsumos !== undefined) data.costoBaseInsumos = input.costoBaseInsumos;
    if (input.tipoCostoInsumo !== undefined) data.tipoCostoInsumo = input.tipoCostoInsumo;
    if (input.precioPorGramo !== undefined) data.precioPorGramo = input.precioPorGramo;
    // FIJO must not carry a per-gram price; clear it when switching modes.
    if (input.tipoCostoInsumo === 'FIJO') data.precioPorGramo = null;

    const updated = await this.servicioRepo.update(input.id, data);

    // Compute precioFinal for response
    const salon = await this.salonRepo.findById(input.salonId);
    const precioFinal = this.computePrecioFinal(
      updated?.precioBase ?? servicio.precioBase,
      salon,
    );

    return ServicioDTO.fromEntity(updated!, precioFinal);
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
