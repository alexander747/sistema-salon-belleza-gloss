import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import type { ICajaRepository } from '../../../../finanzas/domain/ports/ICajaRepository';
import { verificarCajaAbierta } from '../../../../finanzas/application/services/verificarCajaAbierta';
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
    @inject('ICajaRepository') private readonly cajaRepo: ICajaRepository,
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

    // Regla de oro: solo completar una cita (venta) exige caja abierta.
    // Los demás estados (CANCELADA, NO_LLEGO, CONFIRMADA) no se bloquean.
    if (input.estado === EstadoCita.COMPLETADA) {
      await verificarCajaAbierta(this.cajaRepo, cita.salonId);
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
