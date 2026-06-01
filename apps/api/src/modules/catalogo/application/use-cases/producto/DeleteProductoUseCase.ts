import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface DeleteProductoInput {
  salonId: number;
  id: number;
}

interface DeleteProductoOutput {
  success: boolean;
}

@injectable()
export class DeleteProductoUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: DeleteProductoInput): Promise<DeleteProductoOutput> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    const deleted = await this.productoRepo.softDelete(input.id);
    return { success: deleted };
  }
}
