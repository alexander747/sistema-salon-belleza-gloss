import type { CategoriaServicioEntity } from '../../../../infrastructure/persistence/entities/CategoriaServicioEntity';

export class CategoriaServicioDTO {
  id: number;
  nombre: string;
  descripcion: string | null;
  emoji: string | null;
  orden: number;
  activo: boolean;
  salonId: number;
  creadoEn: Date;
  actualizadoEn: Date;

  static fromEntity(entity: CategoriaServicioEntity): CategoriaServicioDTO {
    const dto = new CategoriaServicioDTO();
    dto.id = entity.id;
    dto.nombre = entity.nombre;
    dto.descripcion = entity.descripcion ?? null;
    dto.emoji = entity.emoji ?? null;
    dto.orden = entity.orden;
    dto.activo = entity.activo;
    dto.salonId = entity.salonId;
    dto.creadoEn = entity.creadoEn;
    dto.actualizadoEn = entity.actualizadoEn;
    return dto;
  }
}
