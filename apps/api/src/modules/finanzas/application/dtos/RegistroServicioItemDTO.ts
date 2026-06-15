import type { RegistroServicioItemEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioItemEntity';

export interface RegistroServicioItemDTO {
  id: number;
  servicioId: number;
  nombreServicio: string;
  precioServicio: number;
}

export function registroServicioItemToDTO(entity: RegistroServicioItemEntity): RegistroServicioItemDTO {
  return {
    id: entity.id,
    servicioId: entity.servicioId,
    nombreServicio: entity.nombreServicio,
    precioServicio: Number(entity.precioServicio),
  };
}
