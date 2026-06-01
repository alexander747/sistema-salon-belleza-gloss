import { injectable, inject } from 'tsyringe';
import type { IBloqueoAgendaRepository } from '../../../domain/ports/IBloqueoAgendaRepository';
import { BloqueoAgendaDTO } from '../../dtos/BloqueoAgendaDTO';

export interface ListBloqueosInput {
  salonId: number;
  usuarioId?: number;
}

@injectable()
export class ListBloqueosUseCase {
  constructor(
    @inject('IBloqueoAgendaRepository') private readonly bloqueoRepo: IBloqueoAgendaRepository,
  ) {}

  async execute(input: ListBloqueosInput): Promise<BloqueoAgendaDTO[]> {
    const bloqueos = await this.bloqueoRepo.findBySalon(input.salonId);

    return bloqueos
      .filter((b) => {
        if (input.usuarioId !== undefined && b.usuarioId !== null && b.usuarioId !== input.usuarioId) return false;
        return true;
      })
      .map((b) => BloqueoAgendaDTO.fromEntity(b));
  }
}
