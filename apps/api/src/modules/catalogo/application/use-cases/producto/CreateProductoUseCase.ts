import { injectable, inject } from 'tsyringe';
import type { IProductoRepository } from '../../../domain/ports/IProductoRepository';
import { ProductoDTO } from '../../dtos/ProductoDTO';
import { TipoInventario, TipoPrecio } from '../../../../../infrastructure/persistence/entities/ProductoEntity';
import { normalizeCodigoBarras } from './codigoBarras';
import { ConflictError } from '../../../../../shared/errors';

interface CreateProductoInput {
  salonId: number;
  nombre: string;
  marca?: string;
  codigoBarras?: string | null;
  color?: string;
  tamano?: string;
  descripcion?: string;
  urlFoto?: string;
  precioCompra?: number;
  margenGanancia?: number;
  precioVenta?: number;
  tipoPrecio?: TipoPrecio;
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
    const tipoPrecio = input.tipoPrecio ?? TipoPrecio.MARGEN;

    // FIJO stores the configured price verbatim (create validation requires
    // it). MARGEN keeps an explicit price, otherwise derives it from cost+margin.
    let precioVenta = input.precioVenta;
    if (tipoPrecio === TipoPrecio.FIJO) {
      precioVenta = input.precioVenta ?? 0;
    } else if (precioVenta === undefined || precioVenta === null) {
      precioVenta = Math.round(precioCompra * (1 + margenGanancia / 100) * 100) / 100;
    }

    const codigoBarras = normalizeCodigoBarras(input.codigoBarras);

    // Soft-uniqueness per salon: no DB constraint (multi-tenant), but a duplicate
    // barcode would break scan flows → reject with 409 when another ACTIVE product
    // in the same salon already uses the code.
    if (codigoBarras) {
      const existing = await this.productoRepo.findByCodigoBarras(input.salonId, codigoBarras);
      if (existing) {
        throw new ConflictError('Ya existe un producto con ese código de barras en este salón');
      }
    }

    const producto = await this.productoRepo.create({
      nombre: input.nombre,
      marca: input.marca ?? undefined,
      codigoBarras,
      color: input.color ?? undefined,
      tamano: input.tamano ?? undefined,
      descripcion: input.descripcion ?? undefined,
      urlFoto: input.urlFoto ?? undefined,
      precioCompra,
      margenGanancia,
      precioVenta,
      tipoPrecio,
      cantidadStock: input.cantidadStock ?? 0,
      stockMinimo: input.stockMinimo ?? 0,
      tipoInventario: input.tipoInventario ?? TipoInventario.RETAIL,
      salonId: input.salonId,
      activo: true,
    });

    return ProductoDTO.fromEntity(producto);
  }
}
