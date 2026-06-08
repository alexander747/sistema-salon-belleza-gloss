import type { ServicioEntity } from '../../../../infrastructure/persistence/entities/ServicioEntity';

export class ServicioDTO {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  precioFinal: number;
  duracionMinutos: number;
  activo: boolean;
  categoriaId: number;
  categoria?: { id: number; nombre: string } | null;
  fotosCount?: number;
  creadoEn: Date;
  actualizadoEn: Date;

  static fromEntity(
    entity: ServicioEntity,
    precioFinal?: number,
    fotosCount?: number,
  ): ServicioDTO {
    const dto = new ServicioDTO();
    dto.id = entity.id;
    dto.nombre = entity.nombre;
    dto.descripcion = entity.descripcion ?? null;
    dto.precioBase = Number(entity.precioBase);
    dto.precioFinal = precioFinal ?? Number(entity.precioBase);
    dto.duracionMinutos = entity.duracionMinutos;
    dto.activo = entity.activo;
    dto.categoriaId = entity.categoriaId ?? 0;
    if (entity.categoria) {
      dto.categoria = { id: entity.categoria.id, nombre: entity.categoria.nombre };
    }
    dto.fotosCount = fotosCount;
    dto.creadoEn = entity.creadoEn;
    dto.actualizadoEn = entity.actualizadoEn;
    return dto;
  }
}
