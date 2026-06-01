import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { TipoInventario } from '../../../../../infrastructure/persistence/entities/ProductoEntity';

interface CreateProductoInput {
  salonId: number;
  nombre: string;
  marca?: string;
  color?: string;
  tamano?: string;
  descripcion?: string;
  urlFoto?: string;
  precioCompra?: number;
  precioVenta?: number;
  cantidadStock?: number;
  stockMinimo?: number;
  tipoInventario?: TipoInventario;
}

@injectable()
export class CreateProductoUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: CreateProductoInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.create({
      nombre: input.nombre,
      marca: input.marca ?? undefined,
      color: input.color ?? undefined,
      tamano: input.tamano ?? undefined,
      descripcion: input.descripcion ?? undefined,
      urlFoto: input.urlFoto ?? undefined,
      precioCompra: input.precioCompra ?? 0,
      precioVenta: input.precioVenta ?? 0,
      cantidadStock: input.cantidadStock ?? 0,
      stockMinimo: input.stockMinimo ?? 0,
      tipoInventario: input.tipoInventario ?? TipoInventario.RETAIL,
      salonId: input.salonId,
      activo: true,
    });

    return ProductoDTO.fromEntity(producto);
  }
}
