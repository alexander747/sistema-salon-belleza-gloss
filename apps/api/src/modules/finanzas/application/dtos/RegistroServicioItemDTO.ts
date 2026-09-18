import type { RegistroServicioItemEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioItemEntity';

export interface RegistroServicioItemDTO {
  id: number;
  servicioId: number;
  nombreServicio: string;
  precioServicio: number;
  costoBaseInsumos: number;
  /** Grams used for a `POR_GRAMO` service (per unit); null for `FIJO`/legacy items. */
  gramosUsados: number | null;
  /** Catalog price per gram snapshot; null for `FIJO`/legacy items. */
  precioPorGramo: number | null;
}

export function registroServicioItemToDTO(entity: RegistroServicioItemEntity): RegistroServicioItemDTO {
  return {
    id: entity.id,
    servicioId: entity.servicioId,
    nombreServicio: entity.nombreServicio,
    precioServicio: Number(entity.precioServicio),
    costoBaseInsumos: Number(entity.costoBaseInsumos),
    gramosUsados: entity.gramosUsados != null ? Number(entity.gramosUsados) : null,
    precioPorGramo: entity.precioPorGramo != null ? Number(entity.precioPorGramo) : null,
  };
}
