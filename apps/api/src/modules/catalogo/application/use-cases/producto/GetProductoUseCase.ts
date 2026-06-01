import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { NotFoundError } from '../../../../../shared/errors';
import { Rol } from '@pos-final/types';

interface GetProductoInput {
  salonId: number;
  id: number;
  userRol?: Rol;
}

@injectable()
export class GetProductoUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: GetProductoInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    return ProductoDTO.fromEntity(producto, input.userRol);
  }
}
