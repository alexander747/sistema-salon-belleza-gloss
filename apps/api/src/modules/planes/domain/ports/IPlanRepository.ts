import { PlanEntity } from '../../../../infrastructure/persistence/entities/PlanEntity';

export interface IPlanRepository {
  findAll(): Promise<PlanEntity[]>;
  findById(id: number): Promise<PlanEntity | null>;
  create(data: Partial<PlanEntity>): Promise<PlanEntity>;
  update(id: number, data: Partial<PlanEntity>): Promise<PlanEntity | null>;
  delete(id: number): Promise<boolean>;
}
