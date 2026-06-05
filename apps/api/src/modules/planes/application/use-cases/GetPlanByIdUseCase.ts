import { inject, injectable } from 'tsyringe';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';
import { PlanDTO, toPlanDTO } from '../dto/PlanDTO';

@injectable()
export class GetPlanByIdUseCase {
  constructor(@inject('IPlanRepository') private readonly repo: IPlanRepository) {}

  async execute(id: number): Promise<PlanDTO | null> {
    const plan = await this.repo.findById(id);
    return plan ? toPlanDTO(plan) : null;
  }
}
