import type { RegistroProductoEntity } from '../../../../infrastructure/persistence/entities/RegistroProductoEntity';

export interface RegistroProductoDTO {
  id: number;
  productoId: number;
  nombre: string;
  cantidad: number;
  precioVentaUnitario: number;
  subtotal: number;
}

export function registroProductoToDTO(entity: RegistroProductoEntity): RegistroProductoDTO {
  return {
    id: entity.id,
    productoId: entity.productoId,
    nombre: entity.producto?.nombre ?? '',
    cantidad: Number(entity.cantidad),
    precioVentaUnitario: Number(entity.precioVentaUnitario),
    subtotal: Number(entity.subtotal),
  };
}
