import type { ProductoPrecioHistoricoEntity } from '../../../../infrastructure/persistence/entities/ProductoPrecioHistoricoEntity';

export class ProductoPrecioHistoricoDTO {
  id: number;
  productoId: number;
  precioCompra: number;
  precioVenta: number;
  cantidadAgregada: number;
  stockDespues: number;
  fecha: Date;
  registradoPorId: number | null;

  static fromEntity(entity: ProductoPrecioHistoricoEntity): ProductoPrecioHistoricoDTO {
    const dto = new ProductoPrecioHistoricoDTO();
    dto.id = entity.id;
    dto.productoId = entity.productoId;
    dto.precioCompra = Number(entity.precioCompra);
    dto.precioVenta = Number(entity.precioVenta);
    dto.cantidadAgregada = entity.cantidadAgregada;
    dto.stockDespues = entity.stockDespues;
    dto.fecha = entity.fecha;
    dto.registradoPorId = entity.registradoPorId ?? null;
    return dto;
  }
}
