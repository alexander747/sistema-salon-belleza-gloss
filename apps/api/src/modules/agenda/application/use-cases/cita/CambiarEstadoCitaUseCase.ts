import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import { validarTransicion } from '../../../domain/state-machine';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

export interface CambiarEstadoCitaInput {
  id: number;
  estado: EstadoCita;
  usuarioId?: number;
}

@injectable()
export class CambiarEstadoCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
  ) {}

  async execute(input: CambiarEstadoCitaInput): Promise<CitaDTO> {
    const cita = await this.citaRepo.findById(input.id);
    if (!cita) {
      throw new NotFoundError('Cita no encontrada');
    }

    if (!validarTransicion(cita.estado, input.estado)) {
      throw new UnprocessableEntityError(
        `Transición inválida: de ${cita.estado} a ${input.estado}`,
      );
    }

    // Set auditor field based on target estado
    const extraData: Partial<import('../../../../../infrastructure/persistence/entities/CitaEntity').CitaEntity> = {};
    if (input.estado === EstadoCita.CONFIRMADA) {
      extraData.confirmadoPorId = input.usuarioId;
    } else if (input.estado === EstadoCita.CANCELADA) {
      extraData.canceladoPorId = input.usuarioId;
    }

    const updated = await this.citaRepo.cambiarEstado(input.id, input.estado, extraData);
    return CitaDTO.fromEntity(updated!);
  }
}
