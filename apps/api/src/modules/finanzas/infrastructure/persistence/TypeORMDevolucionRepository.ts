import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { DevolucionEntity } from '../../../../infrastructure/persistence/entities/DevolucionEntity';
import type { IDevolucionRepository } from '../../domain/ports/IDevolucionRepository';

@injectable()
export class TypeORMDevolucionRepository implements IDevolucionRepository {
  private getRepo() {
    return AppDataSource.getRepository(DevolucionEntity);
  }

  async create(data: Partial<DevolucionEntity>): Promise<DevolucionEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async findBySalon(salonId: number): Promise<DevolucionEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      order: { creadoEn: 'DESC' },
    });
  }

  async findByRegistro(registroServicioId: number): Promise<DevolucionEntity[]> {
    return this.getRepo().find({
      where: { registroServicioId },
      order: { creadoEn: 'DESC' },
    });
  }

  async search(params: {
    salonId: number;
    registroServicioId?: number;
    skip?: number;
    take?: number;
  }): Promise<DevolucionEntity[]> {
    const query = this.getRepo()
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.producto', 'producto')
      .where('d.salonId = :salonId', { salonId: params.salonId });

    if (params.registroServicioId !== undefined) {
      query.andWhere('d.registroServicioId = :registroServicioId', {
        registroServicioId: params.registroServicioId,
      });
    }

    query.orderBy('d.creadoEn', 'DESC');

    if (params.skip !== undefined) query.skip(params.skip);
    if (params.take !== undefined && params.take > 0) query.take(params.take);

    return query.getMany();
  }

  async count(params: {
    salonId: number;
    registroServicioId?: number;
  }): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('d')
      .where('d.salonId = :salonId', { salonId: params.salonId });

    if (params.registroServicioId !== undefined) {
      query.andWhere('d.registroServicioId = :registroServicioId', {
        registroServicioId: params.registroServicioId,
      });
    }

    return query.getCount();
  }
}
