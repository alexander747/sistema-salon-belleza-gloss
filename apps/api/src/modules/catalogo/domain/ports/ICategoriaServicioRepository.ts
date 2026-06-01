import type { CategoriaServicioEntity } from '../../../../infrastructure/persistence/entities/CategoriaServicioEntity';

export interface ICategoriaServicioRepository {
  findBySalon(salonId: number): Promise<CategoriaServicioEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<CategoriaServicioEntity | null>;
  findByNameAndSalon(nombre: string, salonId: number): Promise<CategoriaServicioEntity | null>;
  create(data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity>;
  update(id: number, data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity | null>;
  softDelete(id: number): Promise<boolean>;
  countActiveServicios(categoriaId: number): Promise<number>;
}
