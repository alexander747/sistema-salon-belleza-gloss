import { injectable, inject } from 'tsyringe';
import type { IDevolucionRepository } from '../../../domain/ports/IDevolucionRepository';
import type { DevolucionEntity } from '../../../../../infrastructure/persistence/entities/DevolucionEntity';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';

export interface ListDevolucionesInput extends PaginationParams {
  salonId: number;
  registroServicioId?: number;
}

@injectable()
export class ListDevolucionesUseCase {
  constructor(
    @inject('IDevolucionRepository')
    private readonly devolucionRepo: IDevolucionRepository,
  ) {}

  async execute(input: ListDevolucionesInput): Promise<PaginatedResult<DevolucionEntity>> {
    const skip = input.limit > 0 ? (input.page - 1) * input.limit : undefined;

    const [devoluciones, total] = await Promise.all([
      this.devolucionRepo.search({
        salonId: input.salonId,
        registroServicioId: input.registroServicioId,
        skip,
        take: input.limit > 0 ? input.limit : undefined,
      }),
      this.devolucionRepo.count({
        salonId: input.salonId,
        registroServicioId: input.registroServicioId,
      }),
    ]);

    return paginate(devoluciones, total, { page: input.page, limit: input.limit });
  }
}
