import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { Rol } from '@pos-final/types';
import type { TipoInventario } from '../../../../../infrastructure/persistence/entities/ProductoEntity';

interface ListProductosInput {
  salonId: number;
  tipoInventario?: TipoInventario;
  userRol?: Rol;
}

@injectable()
export class ListProductosUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: ListProductosInput): Promise<ProductoDTO[]> {
    const productos = await this.productoRepo.findBySalon(input.salonId, input.tipoInventario);
    return productos.map((producto) => ProductoDTO.fromEntity(producto, input.userRol));
  }
}
