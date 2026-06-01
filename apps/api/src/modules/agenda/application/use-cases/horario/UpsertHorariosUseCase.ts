import { injectable, inject } from 'tsyringe';
import type { IHorarioComercialRepository } from '../../../domain/ports/IHorarioComercialRepository';
import { HorarioComercialDTO } from '../../dtos/HorarioComercialDTO';

export interface UpsertHorarioItem {
  diaSemana: number;
  horaApertura?: string | null;
  horaCierre?: string | null;
  estaAbierto?: boolean;
}

export interface UpsertHorariosInput {
  salonId: number;
  horarios: UpsertHorarioItem[];
}

@injectable()
export class UpsertHorariosUseCase {
  constructor(
    @inject('IHorarioComercialRepository') private readonly horarioRepo: IHorarioComercialRepository,
  ) {}

  async execute(input: UpsertHorariosInput): Promise<HorarioComercialDTO[]> {
    const results: HorarioComercialDTO[] = [];

    for (const h of input.horarios) {
      const saved = await this.horarioRepo.upsert({
        salonId: input.salonId,
        diaSemana: h.diaSemana,
        horaApertura: h.horaApertura ?? undefined,
        horaCierre: h.horaCierre ?? undefined,
        estaAbierto: h.estaAbierto ?? true,
      });

      results.push(HorarioComercialDTO.fromEntity(saved));
    }

    return results;
  }
}
