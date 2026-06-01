import type { ClienteEntity } from '../../../../infrastructure/persistence/entities/ClienteEntity';

export class ClienteDTO {
  id: number;
  nombre: string;
  telefono: string;
  email: string | null;
  puntajeConfianza: number;
  cantidadNoShows: number;
  puntosFidelidad: number;
  totalServicios: number;
  ultimaVisita: Date | null;
  deudaTotal: number;
  servicioFrecuente: string | null;
  activo: boolean;
  fechaNacimiento: Date | null;
  salonId: number;
  creadoEn: Date;
  actualizadoEn: Date;

  static fromEntity(entity: ClienteEntity): ClienteDTO {
    const dto = new ClienteDTO();
    dto.id = entity.id;
    dto.nombre = entity.nombre;
    dto.telefono = entity.telefono;
    dto.email = entity.email ?? null;
    dto.puntajeConfianza = entity.puntajeConfianza;
    dto.cantidadNoShows = entity.cantidadNoShows;
    dto.puntosFidelidad = entity.puntosFidelidad;
    dto.totalServicios = entity.totalServicios;
    dto.ultimaVisita = entity.ultimaVisita ?? null;
    dto.deudaTotal = Number(entity.deudaTotal);
    dto.servicioFrecuente = entity.servicioFrecuente ?? null;
    dto.activo = entity.activo;
    dto.fechaNacimiento = entity.fechaNacimiento ?? null;
    dto.salonId = entity.salonId;
    dto.creadoEn = entity.creadoEn;
    dto.actualizadoEn = entity.actualizadoEn;
    return dto;
  }
}
