import type { HorarioComercialEntity } from '../../../../infrastructure/persistence/entities/HorarioComercialEntity';

export interface IHorarioComercialRepository {
  findBySalonAndDia(salonId: number, diaSemana: number): Promise<HorarioComercialEntity | null>;
  findBySalon(salonId: number): Promise<HorarioComercialEntity[]>;
  upsert(data: Partial<HorarioComercialEntity>): Promise<HorarioComercialEntity>;
}
