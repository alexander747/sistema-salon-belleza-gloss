import { inject, injectable } from 'tsyringe';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';

@injectable()
export class DeletePlanUseCase {
  constructor(@inject('IPlanRepository') private readonly repo: IPlanRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.repo.delete(id);
  }
}
