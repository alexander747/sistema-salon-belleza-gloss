import type { CitaEntity, EstadoCita } from '../../../../infrastructure/persistence/entities/CitaEntity';

export interface ICitaRepository {
  findById(id: number): Promise<CitaEntity | null>;
  findBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<CitaEntity[]>;
  findActiveByUsuario(usuarioId: number, fecha: Date): Promise<CitaEntity[]>;
  create(data: Partial<CitaEntity>): Promise<CitaEntity>;
  update(id: number, data: Partial<CitaEntity>): Promise<CitaEntity | null>;
  cambiarEstado(id: number, estado: EstadoCita, extraData?: Partial<CitaEntity>): Promise<CitaEntity | null>;
}
