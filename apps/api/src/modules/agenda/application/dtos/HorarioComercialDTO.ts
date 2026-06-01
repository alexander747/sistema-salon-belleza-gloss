import type { HorarioComercialEntity } from '../../../../infrastructure/persistence/entities/HorarioComercialEntity';

export class HorarioComercialDTO {
  id: number;
  salonId: number;
  diaSemana: number;
  horaApertura: string | null;
  horaCierre: string | null;
  estaAbierto: boolean;

  static fromEntity(entity: HorarioComercialEntity): HorarioComercialDTO {
    return {
      id: entity.id,
      salonId: entity.salonId,
      diaSemana: entity.diaSemana,
      horaApertura: entity.horaApertura,
      horaCierre: entity.horaCierre,
      estaAbierto: entity.estaAbierto,
    };
  }
}
