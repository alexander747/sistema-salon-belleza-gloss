import { injectable, inject } from 'tsyringe';
import type { IGastoRepository } from '../../../domain/ports/IGastoRepository';
import type { GastoEntity } from '../../../../../infrastructure/persistence/entities/GastoEntity';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';

export interface ListGastosInput extends PaginationParams {
  salonId: number;
  desde?: Date;
  hasta?: Date;
  esGastoFijo?: boolean;
}

@injectable()
export class ListGastosUseCase {
  constructor(
    @inject('IGastoRepository')
    private readonly gastoRepo: IGastoRepository,
  ) {}

  async execute(input: ListGastosInput): Promise<PaginatedResult<GastoEntity>> {
    const skip = input.limit > 0 ? (input.page - 1) * input.limit : undefined;

    const [gastos, total] = await Promise.all([
      this.gastoRepo.search({
        salonId: input.salonId,
        desde: input.desde,
        hasta: input.hasta,
        esGastoFijo: input.esGastoFijo,
        skip,
        take: input.limit > 0 ? input.limit : undefined,
      }),
      this.gastoRepo.count({
        salonId: input.salonId,
        desde: input.desde,
        hasta: input.hasta,
        esGastoFijo: input.esGastoFijo,
      }),
    ]);

    return paginate(gastos, total, { page: input.page, limit: input.limit });
  }
}
