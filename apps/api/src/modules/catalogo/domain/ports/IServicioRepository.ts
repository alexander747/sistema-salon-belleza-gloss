import type { ServicioEntity } from '../../../../infrastructure/persistence/entities/ServicioEntity';
import type { PaginationParams } from '../../../../shared/pagination';

export interface SearchServiciosParams {
  salonId: number;
  categoriaId?: number;
  q?: string;
  pagination?: PaginationParams;
}

export interface IServicioRepository {
  findBySalon(salonId: number, categoriaId?: number): Promise<ServicioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ServicioEntity | null>;
  search(params: SearchServiciosParams): Promise<{ data: ServicioEntity[]; total: number }>;
  create(data: Partial<ServicioEntity>): Promise<ServicioEntity>;
  update(id: number, data: Partial<ServicioEntity>): Promise<ServicioEntity | null>;
  softDelete(id: number): Promise<boolean>;
  countFotos(servicioId: number): Promise<number>;
}
