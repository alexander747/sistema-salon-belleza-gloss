import { injectable, inject } from 'tsyringe';
import type { IBloqueoAgendaRepository } from '../../../domain/ports/IBloqueoAgendaRepository';
import { BloqueoAgendaDTO } from '../../dtos/BloqueoAgendaDTO';
import { ValidationError } from '../../../../../shared/errors';
import { TipoBloqueo } from '../../../../../infrastructure/persistence/entities/BloqueoAgendaEntity';

export interface CreateBloqueoInput {
  salonId: number;
  fechaInicio: Date;
  fechaFin: Date;
  tipo?: string;
  motivo?: string;
  usuarioId?: number | null;
}

@injectable()
export class CreateBloqueoUseCase {
  constructor(
    @inject('IBloqueoAgendaRepository') private readonly bloqueoRepo: IBloqueoAgendaRepository,
  ) {}

  async execute(input: CreateBloqueoInput): Promise<BloqueoAgendaDTO> {
    if (input.fechaInicio >= input.fechaFin) {
      throw new ValidationError('fechaInicio debe ser anterior a fechaFin');
    }

    const bloqueo = await this.bloqueoRepo.create({
      salonId: input.salonId,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      tipo: (input.tipo as TipoBloqueo) ?? undefined,
      motivo: input.motivo ?? undefined,
      usuarioId: input.usuarioId ?? undefined,
    });

    return BloqueoAgendaDTO.fromEntity(bloqueo);
  }
}
