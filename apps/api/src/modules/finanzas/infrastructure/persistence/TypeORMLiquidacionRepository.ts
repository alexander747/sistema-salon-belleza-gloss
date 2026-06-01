import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { LiquidacionEntity } from '../../../../infrastructure/persistence/entities/LiquidacionEntity';
import type { ILiquidacionRepository } from '../../domain/ports/ILiquidacionRepository';

@injectable()
export class TypeORMLiquidacionRepository implements ILiquidacionRepository {
  private getRepo() {
    return AppDataSource.getRepository(LiquidacionEntity);
  }

  async create(data: Partial<LiquidacionEntity>): Promise<LiquidacionEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
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
}
