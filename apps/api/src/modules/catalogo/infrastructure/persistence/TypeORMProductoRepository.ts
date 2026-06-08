import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { ProductoEntity, TipoInventario } from '../../../../infrastructure/persistence/entities/ProductoEntity';
import { ProductoPrecioHistoricoEntity } from '../../../../infrastructure/persistence/entities/ProductoPrecioHistoricoEntity';
import type { IProductoRepository, SearchProductosParams, RestockInput } from '../../domain/ports/IProductoRepository';

@injectable()
export class TypeORMProductoRepository implements IProductoRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(ProductoEntity);
    }
    return AppDataSource.getRepository(ProductoEntity);
  }

  private getHistoricoRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(ProductoPrecioHistoricoEntity);
    }
    return AppDataSource.getRepository(ProductoPrecioHistoricoEntity);
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

  async search(params: SearchProductosParams): Promise<{ data: ProductoEntity[]; total: number }> {
    const queryBuilder = this.getRepo().createQueryBuilder('p')
      .where('p.salonId = :salonId', { salonId: params.salonId })
      .andWhere('p.activo = :activo', { activo: true });

    if (params.tipoInventario) {
      queryBuilder.andWhere('p.tipoInventario = :tipoInventario', { tipoInventario: params.tipoInventario });
    }

    if (params.q) {
      queryBuilder.andWhere(
        '(LOWER(p.nombre) LIKE :q OR LOWER(p.marca) LIKE :q)',
        { q: `%${params.q.toLowerCase()}%` },
      );
    }

    const total = await queryBuilder.getCount();

    if (params.pagination && params.pagination.limit > 0) {
      const skip = (params.pagination.page - 1) * params.pagination.limit;
      queryBuilder.skip(skip).take(params.pagination.limit);
    }

    queryBuilder.orderBy('p.nombre', 'ASC');

    const data = await queryBuilder.getMany();
    return { data, total };
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

  async decrementStock(id: number, cantidad: number, queryRunner?: QueryRunner): Promise<ProductoEntity | null> {
    const repo = this.getRepo(queryRunner);
    const product = await repo.findOneBy({ id });
    if (!product) return null;
    if (product.cantidadStock < cantidad) return null;

    product.cantidadStock = Number(product.cantidadStock) - cantidad;
    return repo.save(product);
  }

  async incrementStock(id: number, cantidad: number, precioCompra?: number, queryRunner?: QueryRunner): Promise<ProductoEntity | null> {
    const repo = this.getRepo(queryRunner);
    const product = await repo.findOneBy({ id });
    if (!product) return null;

    product.cantidadStock = Number(product.cantidadStock) + cantidad;
    if (precioCompra !== undefined) {
      product.precioCompra = precioCompra;
    }
    return repo.save(product);
  }

  async restock(input: RestockInput, queryRunner?: QueryRunner): Promise<ProductoEntity> {
    const repo = this.getRepo(queryRunner);
    const historicoRepo = this.getHistoricoRepo(queryRunner);

    // Update product with new values
    await repo.update(input.productoId, {
      precioCompra: input.nuevoPrecioCompra,
      precioVenta: input.nuevoPrecioVenta,
      cantidadStock: input.stockDespues,
    });

    // Create historial record
    const historial = new ProductoPrecioHistoricoEntity();
    historial.productoId = input.productoId;
    historial.precioCompra = input.precioCompra;
    historial.precioVenta = input.precioVenta;
    historial.cantidadAgregada = input.cantidad;
    historial.stockDespues = input.stockDespues;
    historial.registradoPorId = input.registradoPorId ?? null;
    await historicoRepo.save(historial);

    const updated = await repo.findOneBy({ id: input.productoId });
    return updated!;
  }

  async findHistorial(productoId: number): Promise<ProductoPrecioHistoricoEntity[]> {
    return this.getHistoricoRepo().find({
      where: { productoId },
      order: { fecha: 'DESC' },
    });
  }
}
