import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import type { ICajaRepository } from '../../../../finanzas/domain/ports/ICajaRepository';
import { verificarCajaAbierta } from '../../../../finanzas/application/services/verificarCajaAbierta';
import { CitaDTO } from '../../dtos/CitaDTO';
import { cambiarEstado } from '../../../domain/state-machine';
import { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';
import { NotFoundError } from '../../../../../shared/errors';

export interface CompletarCitaInput {
  id: number;
  usuarioId?: number;
}

@injectable()
export class CompletarCitaUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
    @inject('ICajaRepository') private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: CompletarCitaInput): Promise<CitaDTO> {
    const cita = await this.citaRepo.findById(input.id);
    if (!cita) {
      throw new NotFoundError('Cita no encontrada');
    }

    // Regla de oro: no se completa una cita (venta) sin caja abierta.
    // La cita permanece en su estado previo si no hay caja.
    await verificarCajaAbierta(this.cajaRepo, cita.salonId);

    // Validate & mutate in-memory (throws if invalid transition)
    cambiarEstado(cita, EstadoCita.COMPLETADA);

    // Persist
    const updated = await this.citaRepo.cambiarEstado(input.id, EstadoCita.COMPLETADA, {
      completadoPorId: input.usuarioId,
    });
    return CitaDTO.fromEntity(updated!);
  }
}
