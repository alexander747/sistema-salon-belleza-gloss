import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import { NotFoundError } from '../../../../../shared/errors';

export interface GetCitaInput {
  id: number;
}

@injectable()
export class GetCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
  ) {}

  async execute(input: GetCitaInput): Promise<CitaDTO> {
    const cita = await this.citaRepo.findById(input.id);
    if (!cita) {
      throw new NotFoundError('Cita no encontrada');
    }

    return CitaDTO.fromEntity(cita);
  }
}
