import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { GastoEntity } from '../../../../infrastructure/persistence/entities/GastoEntity';
import type { IGastoRepository } from '../../domain/ports/IGastoRepository';

@injectable()
export class TypeORMGastoRepository implements IGastoRepository {
  private getRepo() {
    return AppDataSource.getRepository(GastoEntity);
  }

  async findById(id: number): Promise<GastoEntity | null> {
    return this.getRepo().findOne({ where: { id } });
  }

  async findBySalon(salonId: number): Promise<GastoEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      order: { fecha: 'DESC' },
    });
  }

  async search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    esGastoFijo?: boolean;
    skip?: number;
    take?: number;
  }): Promise<GastoEntity[]> {
    const query = this.getRepo()
      .createQueryBuilder('g')
      .where('g.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('g.fecha >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('g.fecha <= :hasta', { hasta: params.hasta });
    }
    if (params.esGastoFijo !== undefined) {
      query.andWhere('g.esGastoFijo = :esGastoFijo', { esGastoFijo: params.esGastoFijo });
    }

    query.orderBy('g.fecha', 'DESC');

    if (params.skip !== undefined) query.skip(params.skip);
    if (params.take !== undefined && params.take > 0) query.take(params.take);

    return query.getMany();
  }

  async count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    esGastoFijo?: boolean;
  }): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('g')
      .where('g.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('g.fecha >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('g.fecha <= :hasta', { hasta: params.hasta });
    }
    if (params.esGastoFijo !== undefined) {
      query.andWhere('g.esGastoFijo = :esGastoFijo', { esGastoFijo: params.esGastoFijo });
    }

    return query.getCount();
  }

  async sumBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<number> {
    const result = await this.getRepo()
      .createQueryBuilder('g')
      .select('COALESCE(SUM(g.monto), 0)', 'total')
      .where('g.salonId = :salonId', { salonId })
      .andWhere('g.fecha >= :fechaInicio', { fechaInicio })
      .andWhere('g.fecha < :fechaFin', { fechaFin })
      .getRawOne();
    return Number(result?.total ?? 0);
  }

  async create(data: Partial<GastoEntity>): Promise<GastoEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async delete(id: number): Promise<void> {
    await this.getRepo().delete(id);
  }
}
