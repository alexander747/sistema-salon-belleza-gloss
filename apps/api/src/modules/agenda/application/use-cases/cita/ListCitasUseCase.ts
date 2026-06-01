import { injectable, inject } from 'tsyringe';
import type { ICitaRepository } from '../../../domain/ports/ICitaRepository';
import { CitaDTO } from '../../dtos/CitaDTO';
import type { EstadoCita } from '../../../../../infrastructure/persistence/entities/CitaEntity';

export interface ListCitasInput {
  salonId: number;
  desde?: Date;
  hasta?: Date;
  usuarioId?: number;
  clienteId?: number;
  estado?: EstadoCita;
}

@injectable()
export class ListCitasUseCase {
  constructor(
    @inject('ICitaRepository') private readonly citaRepo: ICitaRepository,
  ) {}

  async execute(input: ListCitasInput): Promise<CitaDTO[]> {
    const inicio = input.desde ?? new Date(new Date().getFullYear(), 0, 1);
    const fin = input.hasta ?? new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    const citas = await this.citaRepo.findBySalonAndDateRange(input.salonId, inicio, fin);

    return citas
      .filter((c) => {
        if (input.usuarioId !== undefined && c.usuarioId !== input.usuarioId) return false;
        if (input.clienteId !== undefined && c.clienteId !== input.clienteId) return false;
        if (input.estado !== undefined && c.estado !== input.estado) return false;
        return true;
      })
      .map((c) => CitaDTO.fromEntity(c));
  }
}
