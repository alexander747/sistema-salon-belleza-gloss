import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoPrecioHistoricoDTO } from '../../dtos/ProductoPrecioHistoricoDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface ObtenerHistorialPreciosInput {
  salonId: number;
  productoId: number;
}

@injectable()
export class ObtenerHistorialPreciosUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: ObtenerHistorialPreciosInput): Promise<ProductoPrecioHistoricoDTO[]> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.productoId);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    const historial = await this.productoRepo.findHistorial(input.productoId);
    return historial.map(ProductoPrecioHistoricoDTO.fromEntity);
  }
}
