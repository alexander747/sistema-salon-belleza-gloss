import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';
import type { IRegistroServicioRepository } from '../../domain/ports/IRegistroServicioRepository';

@injectable()
export class TypeORMRegistroServicioRepository implements IRegistroServicioRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(RegistroServicioEntity);
    }
    return AppDataSource.getRepository(RegistroServicioEntity);
  }

  async create(data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findById(id: number): Promise<RegistroServicioEntity | null> {
    return this.getRepo().findOne({
      where: { id },
      relations: ['pagos', 'divisiones', 'devoluciones', 'cliente', 'usuario'],
    });
  }

  async findBySalon(salonId: number): Promise<RegistroServicioEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      relations: ['pagos', 'divisiones'],
      order: { creadoEn: 'DESC' },
    });
  }

  async findBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<RegistroServicioEntity[]> {
    return this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pagos', 'pago')
      .leftJoinAndSelect('r.divisiones', 'division')
      .leftJoinAndSelect('r.devoluciones', 'devolucion')
      .where('r.salonId = :salonId', { salonId })
      .andWhere('r.creadoEn >= :fechaInicio', { fechaInicio })
      .andWhere('r.creadoEn <= :fechaFin', { fechaFin })
      .orderBy('r.creadoEn', 'DESC')
      .getMany();
  }

  async search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    skip?: number;
    take?: number;
  }): Promise<RegistroServicioEntity[]> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pagos', 'pago')
      .leftJoinAndSelect('r.divisiones', 'division')
      .leftJoinAndSelect('r.cliente', 'cliente')
      .where('r.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('r.creadoEn >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('r.creadoEn <= :hasta', { hasta: params.hasta });
    }
    if (params.usuarioId) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }
    if (params.clienteId) {
      query.andWhere('r.clienteId = :clienteId', { clienteId: params.clienteId });
    }

    if (params.skip !== undefined) query.skip(params.skip);
    if (params.take !== undefined && params.take > 0) query.take(params.take);

    return query.orderBy('r.creadoEn', 'DESC').getMany();
  }

  async count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
  }): Promise<number> {
    const query = this.getRepo()
      .createQueryBuilder('r')
      .where('r.salonId = :salonId', { salonId: params.salonId });

    if (params.desde) {
      query.andWhere('r.creadoEn >= :desde', { desde: params.desde });
    }
    if (params.hasta) {
      query.andWhere('r.creadoEn <= :hasta', { hasta: params.hasta });
    }
    if (params.usuarioId) {
      query.andWhere('r.usuarioId = :usuarioId', { usuarioId: params.usuarioId });
    }
    if (params.clienteId) {
      query.andWhere('r.clienteId = :clienteId', { clienteId: params.clienteId });
    }

    return query.getCount();
  }

  async update(id: number, data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity | null> {
    const repo = this.getRepo(queryRunner);
    await repo.update(id, data);
    if (queryRunner) {
      return queryRunner.manager.findOne(RegistroServicioEntity, { where: { id } });
    }
    return this.findById(id);
  }
}
