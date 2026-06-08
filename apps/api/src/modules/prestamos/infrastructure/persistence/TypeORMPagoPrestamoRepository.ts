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

  async create(data: Partial<PagoPrestamoEntity>): Promise<PagoPrestamoEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }
}
