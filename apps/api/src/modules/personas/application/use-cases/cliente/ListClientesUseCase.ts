import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { ClienteDTO } from '../../dtos/ClienteDTO';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';

interface ListClientesInput extends PaginationParams {
  salonId: number;
  q?: string;
}

@injectable()
export class ListClientesUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: ListClientesInput): Promise<PaginatedResult<ClienteDTO>> {
    const skip = input.limit > 0 ? (input.page - 1) * input.limit : undefined;

    const [clientes, total] = await Promise.all([
      this.clienteRepo.findBySalonPaginated(input.salonId, {
        skip,
        take: input.limit > 0 ? input.limit : undefined,
        q: input.q,
      }),
      this.clienteRepo.countBySalon(input.salonId, input.q),
    ]);

    const dtos = clientes.map((cli) => ClienteDTO.fromEntity(cli));
    return paginate(dtos, total, { page: input.page, limit: input.limit });
  }
}
