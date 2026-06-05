import { inject, injectable } from 'tsyringe';
import { IPlanRepository } from '../../domain/ports/IPlanRepository';
import { PlanDTO, toPlanDTO } from '../dto/PlanDTO';

interface CreatePlanInput {
  nombre: string;
  precioMensual: number;
  maxEmpleadas: number;
  maxSucursales: number;
  features: string[];
}

@injectable()
export class CreatePlanUseCase {
  constructor(@inject('IPlanRepository') private readonly repo: IPlanRepository) {}

  async execute(input: CreatePlanInput): Promise<PlanDTO> {
    const plan = await this.repo.create({
      nombre: input.nombre,
      precioMensual: input.precioMensual,
      maxEmpleadas: input.maxEmpleadas,
      maxSucursales: input.maxSucursales,
      features: input.features,
      activo: true,
    });
    return toPlanDTO(plan);
  }
}
