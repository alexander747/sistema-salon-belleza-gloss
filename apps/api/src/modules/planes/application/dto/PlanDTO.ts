import { PlanEntity } from '../../../../infrastructure/persistence/entities/PlanEntity';

export interface PlanDTO {
  id: number;
  nombre: string;
  precioMensual: number;
  maxEmpleadas: number;
  maxSucursales: number;
  features: string[];
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export function toPlanDTO(entity: PlanEntity): PlanDTO {
  return {
    id: entity.id,
    nombre: entity.nombre,
    precioMensual: entity.precioMensual,
    maxEmpleadas: entity.maxEmpleadas,
    maxSucursales: entity.maxSucursales,
    features: entity.features ?? [],
    activo: entity.activo,
    creadoEn: entity.creadoEn,
    actualizadoEn: entity.actualizadoEn,
  };
}
