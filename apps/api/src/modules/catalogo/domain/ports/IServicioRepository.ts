import type { ServicioEntity } from '../../../../infrastructure/persistence/entities/ServicioEntity';

export interface IServicioRepository {
  findBySalon(salonId: number, categoriaId?: number): Promise<ServicioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ServicioEntity | null>;
  create(data: Partial<ServicioEntity>): Promise<ServicioEntity>;
  update(id: number, data: Partial<ServicioEntity>): Promise<ServicioEntity | null>;
  softDelete(id: number): Promise<boolean>;
  countFotos(servicioId: number): Promise<number>;
}
