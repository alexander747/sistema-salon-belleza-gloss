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
  margenGanancia?: number;
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
    const precioCompra = input.precioCompra ?? 0;
    const margenGanancia = input.margenGanancia ?? 30;

    // Calculate precioVenta from precioCompra + margen if not explicitly provided
    let precioVenta = input.precioVenta;
    if (precioVenta === undefined || precioVenta === null) {
      precioVenta = Math.round(precioCompra * (1 + margenGanancia / 100) * 100) / 100;
    }

    const producto = await this.productoRepo.create({
      nombre: input.nombre,
      marca: input.marca ?? undefined,
      color: input.color ?? undefined,
      tamano: input.tamano ?? undefined,
      descripcion: input.descripcion ?? undefined,
      urlFoto: input.urlFoto ?? undefined,
      precioCompra,
      margenGanancia,
      precioVenta,
      cantidadStock: input.cantidadStock ?? 0,
      stockMinimo: input.stockMinimo ?? 0,
      tipoInventario: input.tipoInventario ?? TipoInventario.RETAIL,
      salonId: input.salonId,
      activo: true,
    });

    return ProductoDTO.fromEntity(producto);
  }
}
