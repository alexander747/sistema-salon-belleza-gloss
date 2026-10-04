import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { PagoPrestamoEntity } from '../../../../infrastructure/persistence/entities/PagoPrestamoEntity';
import type { IPagoPrestamoRepository } from '../../domain/ports/IPagoPrestamoRepository';

@injectable()
export class TypeORMPagoPrestamoRepository implements IPagoPrestamoRepository {
  private getRepo() {
    return AppDataSource.getRepository(PagoPrestamoEntity);
  }

  async findByPrestamo(prestamoId: number): Promise<PagoPrestamoEntity[]> {
    return this.getRepo().find({
      where: { prestamoId },
      order: { fechaPago: 'ASC', creadoEn: 'ASC' },
    });
  }

  async findByCajaId(cajaId: number): Promise<PagoPrestamoEntity[]> {
    return this.getRepo().find({
      where: { cajaId },
      order: { creadoEn: 'ASC' },
    });
  }

  async sumManualBySalonAndDateRange(
    salonId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number> {
    const result = await this.getRepo()
      .createQueryBuilder('p')
      .innerJoin('p.prestamo', 'prestamo')
      .select('COALESCE(SUM(p.monto), 0)', 'total')
      .where('prestamo.salonId = :salonId', { salonId })
      .andWhere('p.tipoPago = :tipo', { tipo: 'MANUAL' })
      .andWhere('p.creadoEn >= :fechaInicio', { fechaInicio })
      .andWhere('p.creadoEn < :fechaFin', { fechaFin })
      .getRawOne();
    return Number(result?.total ?? 0);
  }

  async create(data: Partial<PagoPrestamoEntity>): Promise<PagoPrestamoEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }
}
