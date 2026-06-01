import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { RegistroServicioDTO } from '../../dtos/RegistroServicioDTO';
import { registroServicioToDTO } from '../../dtos/RegistroServicioDTO';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';

export interface ListRegistrosInput extends PaginationParams {
  salonId: number;
  desde?: Date;
  hasta?: Date;
  usuarioId?: number;
  clienteId?: number;
}

@injectable()
export class ListRegistrosUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: ListRegistrosInput): Promise<PaginatedResult<RegistroServicioDTO>> {
    const skip = input.limit > 0 ? (input.page - 1) * input.limit : undefined;

    const [registros, total] = await Promise.all([
      this.registroRepo.search({
        salonId: input.salonId,
        desde: input.desde,
        hasta: input.hasta,
        usuarioId: input.usuarioId,
        clienteId: input.clienteId,
        skip,
        take: input.limit > 0 ? input.limit : undefined,
      }),
      this.registroRepo.count({
        salonId: input.salonId,
        desde: input.desde,
        hasta: input.hasta,
        usuarioId: input.usuarioId,
        clienteId: input.clienteId,
      }),
    ]);

    const dtos = registros.map(registroServicioToDTO);
    return paginate(dtos, total, { page: input.page, limit: input.limit });
  }
}
