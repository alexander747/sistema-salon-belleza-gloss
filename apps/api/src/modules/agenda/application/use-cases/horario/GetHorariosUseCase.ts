import { injectable, inject } from 'tsyringe';
import type { IHorarioComercialRepository } from '../../../domain/ports/IHorarioComercialRepository';
import { HorarioComercialDTO } from '../../dtos/HorarioComercialDTO';

export interface GetHorariosInput {
  salonId: number;
}

@injectable()
export class GetHorariosUseCase {
  constructor(
    @inject('IHorarioComercialRepository') private readonly horarioRepo: IHorarioComercialRepository,
  ) {}

  async execute(input: GetHorariosInput): Promise<HorarioComercialDTO[]> {
    const horarios = await this.horarioRepo.findBySalon(input.salonId);

    // Build a map of existing horarios by diaSemana
    const map = new Map<number, HorarioComercialDTO>();
    for (const h of horarios) {
      map.set(h.diaSemana, HorarioComercialDTO.fromEntity(h));
    }

    // Fill missing days as closed
    const result: HorarioComercialDTO[] = [];
    for (let dia = 0; dia < 7; dia++) {
      if (map.has(dia)) {
        result.push(map.get(dia)!);
      } else {
        result.push({
          id: 0,
          salonId: input.salonId,
          diaSemana: dia,
          horaApertura: null,
          horaCierre: null,
          estaAbierto: false,
        });
      }
    }

    return result;
  }
}
