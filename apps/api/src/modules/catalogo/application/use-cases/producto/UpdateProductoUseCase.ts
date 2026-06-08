import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface UpdateProductoInput {
  salonId: number;
  id: number;
  nombre?: string;
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
  tipoInventario?: string;
}

@injectable()
export class UpdateProductoUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: UpdateProductoInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    const data: Record<string, unknown> = {};
    if (input.nombre !== undefined) data.nombre = input.nombre;
    if (input.marca !== undefined) data.marca = input.marca;
    if (input.color !== undefined) data.color = input.color;
    if (input.tamano !== undefined) data.tamano = input.tamano;
    if (input.descripcion !== undefined) data.descripcion = input.descripcion;
    if (input.urlFoto !== undefined) data.urlFoto = input.urlFoto;
    if (input.precioCompra !== undefined) data.precioCompra = input.precioCompra;
    if (input.margenGanancia !== undefined) data.margenGanancia = input.margenGanancia;
    if (input.cantidadStock !== undefined) data.cantidadStock = input.cantidadStock;
    if (input.stockMinimo !== undefined) data.stockMinimo = input.stockMinimo;
    if (input.tipoInventario !== undefined) data.tipoInventario = input.tipoInventario;

    // Recalculate precioVenta if precioCompra or margen changed and precioVenta not explicitly provided
    const precioCompra = input.precioCompra ?? Number(producto.precioCompra);
    const margenGanancia = input.margenGanancia ?? producto.margenGanancia;

    if (input.precioVenta !== undefined) {
      data.precioVenta = input.precioVenta;
    } else if (input.precioCompra !== undefined || input.margenGanancia !== undefined) {
      // Only auto-calculate if one of the factors changed
      data.precioVenta = Math.round(precioCompra * (1 + margenGanancia / 100) * 100) / 100;
    }

    const updated = await this.productoRepo.update(input.id, data);
    return ProductoDTO.fromEntity(updated!);
  }
}
