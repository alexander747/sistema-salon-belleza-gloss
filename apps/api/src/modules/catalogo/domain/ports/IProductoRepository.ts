import type { QueryRunner } from 'typeorm';
import type { ProductoEntity, TipoInventario } from '../../../../infrastructure/persistence/entities/ProductoEntity';
import type { ProductoPrecioHistoricoEntity } from '../../../../infrastructure/persistence/entities/ProductoPrecioHistoricoEntity';
import type { PaginationParams } from '../../../../shared/pagination';

export interface SearchProductosParams {
  salonId: number;
  tipoInventario?: TipoInventario;
  q?: string;
  pagination?: PaginationParams;
}

export interface RestockInput {
  productoId: number;
  cantidad: number;
  precioCompra: number;
  precioVenta: number;
  nuevoPrecioCompra: number;
  nuevoPrecioVenta: number;
  stockDespues: number;
  registradoPorId?: number;
}

export interface IProductoRepository {
  findBySalon(salonId: number, tipoInventario?: TipoInventario): Promise<ProductoEntity[]>;
  findBySalonAndId(salonId: number, id: number): Promise<ProductoEntity | null>;
  search(params: SearchProductosParams): Promise<{ data: ProductoEntity[]; total: number }>;
  create(data: Partial<ProductoEntity>): Promise<ProductoEntity>;
  update(id: number, data: Partial<ProductoEntity>): Promise<ProductoEntity | null>;
  softDelete(id: number): Promise<boolean>;
  decrementStock(id: number, cantidad: number, queryRunner?: QueryRunner): Promise<ProductoEntity | null>;
  incrementStock(id: number, cantidad: number, precioCompra?: number, queryRunner?: QueryRunner): Promise<ProductoEntity | null>;
  restock(input: RestockInput, queryRunner?: QueryRunner): Promise<ProductoEntity>;
  findHistorial(productoId: number): Promise<ProductoPrecioHistoricoEntity[]>;
}
