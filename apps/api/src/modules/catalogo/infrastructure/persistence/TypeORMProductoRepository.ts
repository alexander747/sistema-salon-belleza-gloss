import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { ProductoEntity, TipoInventario } from '../../../../infrastructure/persistence/entities/ProductoEntity';
import type { IProductoRepository } from '../../domain/ports/IProductoRepository';

@injectable()
export class TypeORMProductoRepository implements IProductoRepository {
  private getRepo() {
    return AppDataSource.getRepository(ProductoEntity);
  }

  async findBySalon(salonId: number, tipoInventario?: TipoInventario): Promise<ProductoEntity[]> {
    const where: Record<string, unknown> = { salonId, activo: true };
    if (tipoInventario) {
      where.tipoInventario = tipoInventario;
    }
    return this.getRepo().find({
      where,
      order: { nombre: 'ASC' },
    });
  }

  async findBySalonAndId(salonId: number, id: number): Promise<ProductoEntity | null> {
    return this.getRepo().findOneBy({ id, salonId });
  }

  async create(data: Partial<ProductoEntity>): Promise<ProductoEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<ProductoEntity>): Promise<ProductoEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOneBy({ id });
  }

  async softDelete(id: number): Promise<boolean> {
    const result = await this.getRepo().update(id, { activo: false });
    return (result.affected ?? 0) > 0;
  }

  async decrementStock(id: number, cantidad: number): Promise<ProductoEntity | null> {
    const product = await this.getRepo().findOneBy({ id });
    if (!product) return null;
    if (product.cantidadStock < cantidad) return null;

    product.cantidadStock = Number(product.cantidadStock) - cantidad;
    return this.getRepo().save(product);
  }

  async incrementStock(id: number, cantidad: number, precioCompra?: number): Promise<ProductoEntity | null> {
    const product = await this.getRepo().findOneBy({ id });
    if (!product) return null;

    product.cantidadStock = Number(product.cantidadStock) + cantidad;
    if (precioCompra !== undefined) {
      product.precioCompra = precioCompra;
    }
    return this.getRepo().save(product);
  }
}
