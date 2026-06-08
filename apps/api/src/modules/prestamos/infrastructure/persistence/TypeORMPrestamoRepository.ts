import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { PrestamoEntity } from '../../../../infrastructure/persistence/entities/PrestamoEntity';
import type { IPrestamoRepository, PrestamoSearchParams } from '../../domain/ports/IPrestamoRepository';

@injectable()
export class TypeORMPrestamoRepository implements IPrestamoRepository {
  private getRepo() {
    return AppDataSource.getRepository(PrestamoEntity);
  }

  async findById(id: number): Promise<PrestamoEntity | null> {
    return this.getRepo().findOne({
      where: { id },
      relations: ['usuario'],
    });
  }

  async findBySalon(params: PrestamoSearchParams): Promise<[PrestamoEntity[], number]> {
    const query = this.getRepo()
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'usuario')
      .where('p.salonId = :salonId', { salonId: params.salonId });

    if (params.estado) {
      query.andWhere('p.estado = :estado', { estado: params.estado });
    }
    if (params.usuarioId) {
      query.andWhere('p.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }

    query.orderBy('p.creadoEn', 'DESC');

    const total = await query.getCount();

    const page = params.page ?? 1;
    const limit = params.limit ?? 0;
    if (limit > 0) {
      query.skip((page - 1) * limit).take(limit);
    }

    const data = await query.getMany();
    return [data, total];
  }

  async findByUsuario(salonId: number, usuarioId: number): Promise<PrestamoEntity[]> {
    return this.getRepo().find({
      where: { salonId, usuarioId },
      relations: ['usuario'],
      order: { creadoEn: 'DESC' },
    });
  }

  async findActivosByUsuario(salonId: number, usuarioId: number): Promise<PrestamoEntity[]> {
    return this.getRepo().find({
      where: { salonId, usuarioId, estado: 'ACTIVO' },
      order: { creadoEn: 'DESC' },
    });
  }

  async create(data: Partial<PrestamoEntity>): Promise<PrestamoEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<PrestamoEntity>): Promise<PrestamoEntity | null> {
    await this.getRepo().update(id, data);
    return this.getRepo().findOne({ where: { id }, relations: ['usuario'] });
  }
}
