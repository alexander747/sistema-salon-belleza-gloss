import { Rol } from '@pos-final/types';
import type { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';

export class EmpleadaDTO {
  id: number;
  nombre: string;
  numeroWhatsApp: string;
  email: string;
  avatar: string | null;
  fechaNacimiento: Date | null;
  rol: Rol;
  activo: boolean;
  porcentajeComisionServicio: number | null;
  sueldoFijo: number | null;
  bonoHorario: number | null;
  frecuenciaBono: string | null;
  salonId: number;
  creadoEn: Date;
  actualizadoEn: Date;

  static fromEntity(entity: UsuarioEntity, userRol: Rol): EmpleadaDTO {
    const dto = new EmpleadaDTO();
    dto.id = entity.id;
    dto.nombre = entity.nombre;
    dto.numeroWhatsApp = entity.numeroWhatsApp;
    dto.email = entity.email;
    dto.avatar = entity.avatar ?? null;
    dto.fechaNacimiento = entity.fechaNacimiento ?? null;
    dto.rol = entity.rol;
    dto.activo = entity.activo;
    dto.salonId = entity.salonId ?? 0;
    dto.creadoEn = entity.creadoEn;
    dto.actualizadoEn = entity.actualizadoEn;

    // Strip compensation fields for non-owner/non-admin roles
    if (userRol === Rol.DUEÑA || userRol === Rol.ADMINISTRADOR) {
      dto.porcentajeComisionServicio = Number(entity.porcentajeComisionServicio);
      dto.sueldoFijo = Number(entity.sueldoFijo);
      dto.bonoHorario = Number(entity.bonoHorario);
      dto.frecuenciaBono = entity.frecuenciaBono ?? null;
    } else {
      dto.porcentajeComisionServicio = null;
      dto.sueldoFijo = null;
      dto.bonoHorario = null;
      dto.frecuenciaBono = null;
    }

    return dto;
  }
}
