import type { BloqueoAgendaEntity } from '../../../../infrastructure/persistence/entities/BloqueoAgendaEntity';

export interface IBloqueoAgendaRepository {
  findBySalon(salonId: number): Promise<BloqueoAgendaEntity[]>;
  findByUsuarioAndDateRange(usuarioId: number, fechaInicio: Date, fechaFin: Date): Promise<BloqueoAgendaEntity[]>;
  findBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<BloqueoAgendaEntity[]>;
  create(data: Partial<BloqueoAgendaEntity>): Promise<BloqueoAgendaEntity>;
  delete(id: number): Promise<boolean>;
}
