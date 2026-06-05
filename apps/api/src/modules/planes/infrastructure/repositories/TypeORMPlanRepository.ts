import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { PlanEntity } from '../../../../infrastructure/persistence/entities/PlanEntity';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';

@injectable()
export class TypeORMPlanRepository implements IPlanRepository {
  private repo: Repository<PlanEntity> = AppDataSource.getRepository(PlanEntity);

  async findAll(): Promise<PlanEntity[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  async findById(id: number): Promise<PlanEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<PlanEntity>): Promise<PlanEntity> {
    const plan = this.repo.create(data);
    return this.repo.save(plan);
  }

  async update(id: number, data: Partial<PlanEntity>): Promise<PlanEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
