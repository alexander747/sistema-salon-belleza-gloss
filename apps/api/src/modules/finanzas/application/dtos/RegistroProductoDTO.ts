import type { RegistroProductoEntity } from '../../../../infrastructure/persistence/entities/RegistroProductoEntity';

export interface RegistroProductoDTO {
  id: number;
  productoId: number;
  nombre: string;
  cantidad: number;
  precioVentaUnitario: number;
  /**
   * COGS snapshot: purchase cost per unit at sale time. Null for legacy rows
   * created before the column existed.
   */
  costoUnitario: number | null;
  subtotal: number;
}

export function registroProductoToDTO(entity: RegistroProductoEntity): RegistroProductoDTO {
  return {
    id: entity.id,
    productoId: entity.productoId,
    nombre: entity.producto?.nombre ?? '',
    cantidad: Number(entity.cantidad),
    precioVentaUnitario: Number(entity.precioVentaUnitario),
    costoUnitario: entity.costoUnitario != null ? Number(entity.costoUnitario) : null,
    subtotal: Number(entity.subtotal),
  };
}
