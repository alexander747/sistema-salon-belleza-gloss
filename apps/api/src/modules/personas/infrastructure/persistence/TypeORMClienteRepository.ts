import { injectable } from 'tsyringe';
import { Like } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { ClienteEntity } from '../../../../infrastructure/persistence/entities/ClienteEntity';
import type { IClienteRepository, FindBySalonPaginatedOptions } from '../../domain/ports/IClienteRepository';

@injectable()
export class TypeORMClienteRepository implements IClienteRepository {
  private getRepo() {
    return AppDataSource.getRepository(ClienteEntity);
  }

  async findBySalon(salonId: number, telefono?: string): Promise<ClienteEntity[]> {
    const where: Record<string, unknown> = { salonId };
    if (telefono !== undefined) where.telefono = telefono;
    return this.getRepo().find({ where, order: { nombre: 'ASC' } });
  }

  async findBySalonAndId(salonId: number, id: number): Promise<ClienteEntity | null> {
    return this.getRepo().findOneBy({ id, salonId });
  }

  async findBySalonAndTelefono(salonId: number, telefono: string): Promise<ClienteEntity | null> {
    return this.getRepo().findOneBy({ telefono, salonId });
  }

  async findBySalonAndCedula(salonId: number, cedula: string): Promise<ClienteEntity | null> {
    return this.getRepo().findOneBy({ cedula, salonId });
  }

  async findBySalonPaginated(salonId: number, options: FindBySalonPaginatedOptions): Promise<ClienteEntity[]> {
    const where: Record<string, unknown> = { salonId };
    if (options.q) {
      const q = `%${options.q}%`;
      where.nombre = Like(q);
      // Use raw query approach to search multiple columns via OR
      const qb = this.getRepo().createQueryBuilder('cliente')
        .where('cliente.salonId = :salonId', { salonId })
        .andWhere(
          '(cliente.nombre LIKE :q OR cliente.telefono LIKE :q OR cliente.cedula LIKE :q)',
          { q },
        )
        .orderBy('cliente.id', 'DESC');
      if (options.skip !== undefined) qb.skip(options.skip);
      if (options.take !== undefined) qb.take(options.take);
      return qb.getMany();
    }
    return this.getRepo().find({
      where,
      order: { id: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
  }

  async countBySalon(salonId: number, q?: string): Promise<number> {
    if (q) {
      const qb = this.getRepo().createQueryBuilder('cliente')
        .where('cliente.salonId = :salonId', { salonId })
        .andWhere(
          '(cliente.nombre LIKE :q OR cliente.telefono LIKE :q OR cliente.cedula LIKE :q)',
          { q: `%${q}%` },
        );
      return qb.getCount();
    }
    return this.getRepo().countBy({ salonId });
  }

  async create(data: Partial<ClienteEntity>): Promise<ClienteEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<ClienteEntity>): Promise<ClienteEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOneBy({ id });
  }
}
