import { inject, injectable } from 'tsyringe';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';
import { PlanDTO, toPlanDTO } from '../dto/PlanDTO';

@injectable()
export class ListPlanesUseCase {
  constructor(@inject('IPlanRepository') private readonly repo: IPlanRepository) {}

  async execute(): Promise<PlanDTO[]> {
    const planes = await this.repo.findAll();
    return planes.map(toPlanDTO);
  }
}
