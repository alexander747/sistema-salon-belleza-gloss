import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { CitaEntity, EstadoCita } from '../../../../infrastructure/persistence/entities/CitaEntity';
import type { ICitaRepository } from '../../domain/ports/ICitaRepository';

@injectable()
export class TypeORMCitaRepository implements ICitaRepository {
  private getRepo() {
    return AppDataSource.getRepository(CitaEntity);
  }

  async findById(id: number): Promise<CitaEntity | null> {
    return this.getRepo().findOne({
      where: { id },
      relations: ['servicios'],
    });
  }

  async findBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<CitaEntity[]> {
    return this.getRepo()
      .createQueryBuilder('cita')
      .leftJoinAndSelect('cita.servicios', 'servicio')
      .where('cita.salonId = :salonId', { salonId })
      .andWhere('cita.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('cita.fechaHora <= :fechaFin', { fechaFin })
      .orderBy('cita.fechaHora', 'ASC')
      .getMany();
  }

  async findActiveByUsuario(usuarioId: number, fecha: Date): Promise<CitaEntity[]> {
    const diaStart = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
    const diaEnd = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);

    return this.getRepo()
      .createQueryBuilder('cita')
      .leftJoinAndSelect('cita.servicios', 'servicio')
      .where('cita.usuarioId = :usuarioId', { usuarioId })
      .andWhere('cita.estado IN (:...estados)', {
        estados: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA],
      })
      .andWhere('cita.fechaHora >= :diaStart', { diaStart })
      .andWhere('cita.fechaHora <= :diaEnd', { diaEnd })
      .orderBy('cita.fechaHora', 'ASC')
      .getMany();
  }

  async create(data: Partial<CitaEntity>): Promise<CitaEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<CitaEntity>): Promise<CitaEntity | null> {
    await this.getRepo().update(id, data);
    return this.findById(id);
  }

  async cambiarEstado(id: number, estado: EstadoCita, extraData?: Partial<CitaEntity>): Promise<CitaEntity | null> {
    await this.getRepo().update(id, { estado, ...extraData });
    return this.findById(id);
  }
}
