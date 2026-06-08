import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';
import type { QueryRunner } from 'typeorm';
import type { ILiquidacionRepository } from '../../domain/ports/ILiquidacionRepository';

@injectable()
export class TypeORMLiquidacionRepository implements ILiquidacionRepository {
  private getRepo(qr?: QueryRunner) {
    if (qr) {
      return qr.manager.getRepository(LiquidacionEntity);
    }
    return AppDataSource.getRepository(LiquidacionEntity);
  }

  async create(data: Partial<LiquidacionEntity>, queryRunner?: QueryRunner): Promise<LiquidacionEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findById(id: number): Promise<LiquidacionEntity | null> {
    return this.getRepo().findOne({
      where: { id },
      relations: ['registros'],
    });
  }

  async findBySalon(salonId: number): Promise<LiquidacionEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      order: { creadoEn: 'DESC' },
    });
  }

  async findBySalonAndEmpleada(salonId: number, usuarioId: number): Promise<LiquidacionEntity[]> {
    return this.getRepo().find({
      where: { salonId, usuarioId },
      order: { creadoEn: 'DESC' },
    });
  }

  async findBySalonEmpleadaAndPeriodo(
    salonId: number,
    usuarioId: number,
    fechaDesde: Date,
    fechaHasta: Date,
  ): Promise<LiquidacionEntity[]> {
    return this.getRepo()
      .createQueryBuilder('l')
      .where('l.salonId = :salonId', { salonId })
      .andWhere('l.usuarioId = :usuarioId', { usuarioId })
      .andWhere(
        '(l.fechaDesde <= :fechaHasta AND l.fechaHasta >= :fechaDesde)',
        { fechaDesde, fechaHasta },
      )
      .getMany();
  }
}
