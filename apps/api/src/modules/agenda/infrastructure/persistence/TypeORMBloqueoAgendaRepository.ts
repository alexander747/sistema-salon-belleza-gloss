import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { BloqueoAgendaEntity } from '../../../../infrastructure/persistence/entities/BloqueoAgendaEntity';
import type { IBloqueoAgendaRepository } from '../../domain/ports/IBloqueoAgendaRepository';

@injectable()
export class TypeORMBloqueoAgendaRepository implements IBloqueoAgendaRepository {
  private getRepo() {
    return AppDataSource.getRepository(BloqueoAgendaEntity);
  }

  async findBySalon(salonId: number): Promise<BloqueoAgendaEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      order: { fechaInicio: 'DESC' },
    });
  }

  async findByUsuarioAndDateRange(
    usuarioId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<BloqueoAgendaEntity[]> {
    return this.getRepo()
      .createQueryBuilder('b')
      .where('b.usuarioId = :usuarioId', { usuarioId })
      .andWhere('b.fechaInicio < :fechaFin', { fechaFin })
      .andWhere('b.fechaFin > :fechaInicio', { fechaInicio })
      .getMany();
  }

  async findBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<BloqueoAgendaEntity[]> {
    return this.getRepo()
      .createQueryBuilder('b')
      .where('b.salonId = :salonId', { salonId })
      .andWhere('b.fechaInicio < :fechaFin', { fechaFin })
      .andWhere('b.fechaFin > :fechaInicio', { fechaInicio })
      .getMany();
  }

  async create(data: Partial<BloqueoAgendaEntity>): Promise<BloqueoAgendaEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.getRepo().delete(id);
    return (result.affected ?? 0) > 0;
  }
}
