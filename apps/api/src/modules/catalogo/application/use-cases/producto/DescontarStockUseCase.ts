import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

interface DescontarStockInput {
  salonId: number;
  id: number;
  cantidad: number;
}

@injectable()
export class DescontarStockUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: DescontarStockInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    if (Number(producto.cantidadStock) < input.cantidad) {
      throw new UnprocessableEntityError(
        `Stock insuficiente. Disponible: ${producto.cantidadStock}, solicitado: ${input.cantidad}`,
      );
    }

    const updated = await this.productoRepo.decrementStock(input.id, input.cantidad);
    return ProductoDTO.fromEntity(updated!);
  }
}
