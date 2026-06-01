import type { ProductoEntity, TipoInventario } from '../../../../infrastructure/persistence/entities/ProductoEntity';

export interface IProductoRepository {
  findBySalon(salonId: number, tipoInventario?: TipoInventario): Promise<ProductoEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ProductoEntity | null>;
  create(data: Partial<ProductoEntity>): Promise<ProductoEntity>;
  update(id: number, data: Partial<ProductoEntity>): Promise<ProductoEntity | null>;
  softDelete(id: number): Promise<boolean>;
  decrementStock(id: number, cantidad: number): Promise<ProductoEntity | null>;
  incrementStock(id: number, cantidad: number, precioCompra?: number): Promise<ProductoEntity | null>;
}
