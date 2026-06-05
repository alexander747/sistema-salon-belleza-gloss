import { inject, injectable } from 'tsyringe';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';
import { PlanDTO, toPlanDTO } from '../dto/PlanDTO';

interface UpdatePlanInput {
  nombre?: string;
  precioMensual?: number;
  maxEmpleadas?: number;
  maxSucursales?: number;
  features?: string[];
  activo?: boolean;
}

@injectable()
export class UpdatePlanUseCase {
  constructor(@inject('IPlanRepository') private readonly repo: IPlanRepository) {}

  async execute(id: number, input: UpdatePlanInput): Promise<PlanDTO | null> {
    const plan = await this.repo.update(id, input);
    return plan ? toPlanDTO(plan) : null;
  }
}
