import { injectable, inject } from 'tsyringe';
import type { ICajaRepository } from '../../../domain/ports/ICajaRepository';
import type { EstadoCaja } from '../../../../../infrastructure/persistence/entities/CajaEntity';
import type { CajaDTO } from '../../dtos/CajaDTO';
import { cajaToDTO } from '../../dtos/CajaDTO';
import type { PaginationParams, PaginatedResult } from '../../../../../shared/pagination';
import { paginate } from '../../../../../shared/pagination';

export interface ListarCierresCajaInput extends PaginationParams {
  salonId: number;
  estado?: EstadoCaja;
}

@injectable()
export class ListarCierresCajaUseCase {
  constructor(
    @inject('ICajaRepository')
    private readonly cajaRepo: ICajaRepository,
  ) {}

  async execute(input: ListarCierresCajaInput): Promise<PaginatedResult<CajaDTO>> {
    // Sin estado → TODAS las cajas (ABIERTA + CERRADA). El repo aplica el filtro
    // solo si `estado` es truthy; el controller mapea TODAS/ausente → undefined.
    const estado = input.estado;
    const { data, total } = await this.cajaRepo.listBySalonPaginated(
      input.salonId,
      input.page,
      input.limit,
      estado,
    );

    return paginate(data.map(cajaToDTO), total, { page: input.page, limit: input.limit });
  }
}
