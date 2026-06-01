import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { CategoriaServicioEntity } from '../../../../infrastructure/persistence/entities/CategoriaServicioEntity';
import { ServicioEntity } from '../../../../infrastructure/persistence/entities/ServicioEntity';
import type { ICategoriaServicioRepository } from '../../domain/ports/ICategoriaServicioRepository';

@injectable()
export class TypeORMCategoriaServicioRepository implements ICategoriaServicioRepository {
  private getRepo() {
    return AppDataSource.getRepository(CategoriaServicioEntity);
  }

  async findBySalon(salonId: number): Promise<CategoriaServicioEntity[]> {
    return this.getRepo().find({
      where: { salonId, activo: true },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  }

  async findBySalonAndId(salonId: number, id: number): Promise<CategoriaServicioEntity | null> {
    return this.getRepo().findOneBy({ id, salonId });
  }

  async findByNameAndSalon(nombre: string, salonId: number): Promise<CategoriaServicioEntity | null> {
    return this.getRepo().findOneBy({ nombre, salonId });
  }

  async create(data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<CategoriaServicioEntity>): Promise<CategoriaServicioEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOneBy({ id });
  }

  async softDelete(id: number): Promise<boolean> {
    const result = await this.getRepo().update(id, { activo: false });
    return (result.affected ?? 0) > 0;
  }

  async countActiveServicios(categoriaId: number): Promise<number> {
    return AppDataSource.getRepository(ServicioEntity).countBy({
      categoriaId,
      activo: true,
    });
  }
}
