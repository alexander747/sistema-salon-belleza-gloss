import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '../../../../../shared/database';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface RestockProductoInput {
  salonId: number;
  id: number;
  cantidad: number;
  precioCompra: number;
  registradoPorId?: number;
}

@injectable()
export class RestockProductoUseCase {
  constructor(
    @inject('IProductoRepository') private readonly productoRepo: IProductoRepository,
  ) {}

  async execute(input: RestockProductoInput): Promise<ProductoDTO> {
    const producto = await this.productoRepo.findBySalonAndId(input.salonId, input.id);
    if (!producto) {
      throw new NotFoundError('Producto no encontrado');
    }

    const stockActual = Number(producto.cantidadStock);
    const precioCompraActual = Number(producto.precioCompra);
    const margenGanancia = producto.margenGanancia;
    const cantidadNueva = input.cantidad;
    const precioCompraNuevo = input.precioCompra;

    // Calculate PMP (Precio Medio Ponderado)
    const nuevoPrecioCompra = stockActual > 0
      ? Math.round(
          ((stockActual * precioCompraActual) + (cantidadNueva * precioCompraNuevo)) / (stockActual + cantidadNueva) * 100
        ) / 100
      : precioCompraNuevo;

    // Calculate new precioVenta
    const nuevoPrecioVenta = Math.round(nuevoPrecioCompra * (1 + margenGanancia / 100) * 100) / 100;

    // Update product in a transaction
    const queryRunner = AppDataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const updated = await this.productoRepo.restock(
        {
          productoId: input.id,
          cantidad: cantidadNueva,
          precioCompra: precioCompraNuevo,
          precioVenta: nuevoPrecioVenta,
          nuevoPrecioCompra,
          nuevoPrecioVenta,
          stockDespues: stockActual + cantidadNueva,
          registradoPorId: input.registradoPorId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return ProductoDTO.fromEntity(updated);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
