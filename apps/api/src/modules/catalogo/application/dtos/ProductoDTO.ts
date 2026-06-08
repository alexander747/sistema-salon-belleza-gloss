import { Rol } from '@pos-final/types';
import type { ProductoEntity } from '../../../../infrastructure/persistence/entities/ProductoEntity';
import type { ProductoPrecioHistoricoEntity } from '../../../../infrastructure/persistence/entities/ProductoPrecioHistoricoEntity';
import { ProductoPrecioHistoricoDTO } from './ProductoPrecioHistoricoDTO';

export class ProductoDTO {
  id: number;
  nombre: string;
  marca: string | null;
  color: string | null;
  tamano: string | null;
  descripcion: string | null;
  urlFoto: string | null;
  precioVenta: number;
  precioCompra?: number;
  margenGanancia: number;
  cantidadStock: number;
  stockMinimo: number;
  tipoInventario: string;
  activo: boolean;
  salonId: number;
  creadoEn: Date;
  actualizadoEn: Date;
  historialPrecios?: ProductoPrecioHistoricoDTO[];

  static fromEntity(
    entity: ProductoEntity,
    userRol?: Rol,
    historial?: ProductoPrecioHistoricoEntity[],
  ): ProductoDTO {
    const dto = new ProductoDTO();
    dto.id = entity.id;
    dto.nombre = entity.nombre;
    dto.marca = entity.marca ?? null;
    dto.color = entity.color ?? null;
    dto.tamano = entity.tamano ?? null;
    dto.descripcion = entity.descripcion ?? null;
    dto.urlFoto = entity.urlFoto ?? null;
    dto.precioVenta = Number(entity.precioVenta);
    dto.margenGanancia = entity.margenGanancia;
    dto.cantidadStock = Number(entity.cantidadStock);
    dto.stockMinimo = Number(entity.stockMinimo);
    dto.tipoInventario = entity.tipoInventario;
    dto.activo = entity.activo;
    dto.salonId = entity.salonId;
    dto.creadoEn = entity.creadoEn;
    dto.actualizadoEn = entity.actualizadoEn;

    // Only DUEÑA, ADMINISTRADOR, CONTADOR, and SUPERADMIN see purchase cost
    if (userRol === Rol.DUEÑA || userRol === Rol.ADMINISTRADOR || userRol === Rol.CONTADOR || userRol === Rol.SUPERADMIN) {
      dto.precioCompra = Number(entity.precioCompra);
    }

    if (historial) {
      dto.historialPrecios = historial.map(ProductoPrecioHistoricoDTO.fromEntity);
    }

    return dto;
  }
}
