import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { ServicioEntity } from '../../../../infrastructure/persistence/entities/ServicioEntity';
import { FotoPortafolioEntity } from '../../../../infrastructure/persistence/entities/FotoPortafolioEntity';
import type { IServicioRepository } from '../../domain/ports/IServicioRepository';

@injectable()
export class TypeORMServicioRepository implements IServicioRepository {
  private getRepo() {
    return AppDataSource.getRepository(ServicioEntity);
  }

  async findBySalon(salonId: number, categoriaId?: number): Promise<ServicioEntity[]> {
    const query = this.getRepo()
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.categoria', 'categoria')
      .where('(categoria.id IS NULL OR categoria.salonId = :salonId)', { salonId })
      .andWhere('servicio.activo = :activo', { activo: true })
      .orderBy('servicio.nombre', 'ASC');

    if (categoriaId !== undefined) {
      query.andWhere('servicio.categoriaId = :categoriaId', { categoriaId });
    }

    return query.getMany();
  }

  async findBySalonAndId(salonId: number, id: number): Promise<ServicioEntity | null> {
    const servicio = await this.getRepo().findOne({
      where: { id },
      relations: { categoria: true },
    });

    if (!servicio) return null;
    // If no categoria, allow access (tenant isolation handled by middleware)
    if (servicio.categoria && servicio.categoria.salonId !== salonId) {
      return null;
    }

    return servicio;
  }

  async create(data: Partial<ServicioEntity>): Promise<ServicioEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<ServicioEntity>): Promise<ServicioEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOne({
      where: { id },
      relations: { categoria: true },
    });
  }

  async softDelete(id: number): Promise<boolean> {
    const result = await this.getRepo().update(id, { activo: false });
    return (result.affected ?? 0) > 0;
  }

  async countFotos(servicioId: number): Promise<number> {
    return AppDataSource.getRepository(FotoPortafolioEntity).countBy({
      servicioId,
    });
  }
}
