import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import { cambiarEstado } from '../../../domain/state-machine';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError } from '../../../../../shared/errors';

export interface CompletarCitaInput {
  id: number;
}

@injectable()
export class CompletarCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
  ) {}

  async execute(input: CompletarCitaInput): Promise<CitaDTO> {
    const cita = await this.citaRepo.findById(input.id);
    if (!cita) {
      throw new NotFoundError('Cita no encontrada');
    }

    // Validate & mutate in-memory (throws if invalid transition)
    cambiarEstado(cita, EstadoCita.COMPLETADA);

    // Persist
    const updated = await this.citaRepo.cambiarEstado(input.id, EstadoCita.COMPLETADA);
    return CitaDTO.fromEntity(updated!);
  }
}
