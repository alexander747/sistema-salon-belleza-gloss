import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { Rol } from '@pos-final/types';
import type { TipoInventario } from '../../../../../infrastructure/persistence/entities/ProductoEntity';
import { paginate, type PaginatedResult } from '../../../../../shared/pagination';

interface ListProductosInput {
  salonId: number;
  tipoInventario?: TipoInventario;
  userRol?: Rol;
  page?: number;
  limit?: number;
  q?: string;
}

@injectable()
export class ListProductosUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: ListProductosInput): Promise<PaginatedResult<ProductoDTO> | ProductoDTO[]> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 0;
    const hasPagination = limit > 0;

    if (hasPagination) {
      const { data, total } = await this.productoRepo.search({
        salonId: input.salonId,
        tipoInventario: input.tipoInventario,
        q: input.q,
        pagination: { page, limit },
      });

      const dtos = data.map((producto) => ProductoDTO.fromEntity(producto, input.userRol));
      return paginate(dtos, total, { page, limit });
    }

    // Legacy behavior: return all
    const productos = await this.productoRepo.findBySalon(input.salonId, input.tipoInventario);
    return productos.map((producto) => ProductoDTO.fromEntity(producto, input.userRol));
  }
}
