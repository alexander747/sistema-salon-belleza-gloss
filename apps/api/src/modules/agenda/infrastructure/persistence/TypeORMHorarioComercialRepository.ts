import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { HorarioComercialEntity } from '../../../../infrastructure/persistence/entities/HorarioComercialEntity';
import type { IHorarioComercialRepository } from '../../domain/ports/IHorarioComercialRepository';

@injectable()
export class TypeORMHorarioComercialRepository implements IHorarioComercialRepository {
  private getRepo() {
    return AppDataSource.getRepository(HorarioComercialEntity);
  }

  async findBySalonAndDia(salonId: number, diaSemana: number): Promise<HorarioComercialEntity | null> {
    return this.getRepo().findOneBy({ salonId, diaSemana });
  }

  async findBySalon(salonId: number): Promise<HorarioComercialEntity[]> {
    return this.getRepo().find({
      where: { salonId },
      order: { diaSemana: 'ASC' },
    });
  }

  async upsert(data: Partial<HorarioComercialEntity>): Promise<HorarioComercialEntity> {
    const where = data.id
      ? { id: data.id } as const
      : { salonId: data.salonId!, diaSemana: data.diaSemana! };

    const existing = await this.getRepo().findOneBy(where);

    if (existing) {
      await this.getRepo().update(existing.id, data);
      return (await this.getRepo().findOneBy({ id: existing.id }))!;
    }

    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }
}
