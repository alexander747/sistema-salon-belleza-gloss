import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface ReabastecerStockInput {
  salonId: number;
  id: number;
  cantidad: number;
  precioCompra?: number;
}

@injectable()
export class ReabastecerStockUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: ReabastecerStockInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    const updated = await this.productoRepo.incrementStock(input.id, input.cantidad, input.precioCompra);
    return ProductoDTO.fromEntity(updated!);
  }
}
