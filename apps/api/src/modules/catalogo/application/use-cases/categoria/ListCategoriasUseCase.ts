import { injectable, inject } from 'tsyringe';
import type { ICategoriaServicioRepository } from '../../../domain/ports/ICategoriaServicioRepository';
import { CategoriaServicioDTO } from '../../dtos/CategoriaServicioDTO';

interface ListCategoriasInput {
  salonId: number;
}

@injectable()
export class ListCategoriasUseCase {
  constructor(
    @inject('ICategoriaServicioRepository') private readonly categoriaRepo: ICategoriaServicioRepository,
  ) {}

  async execute(input: ListCategoriasInput): Promise<CategoriaServicioDTO[]> {
    const categorias = await this.categoriaRepo.findBySalon(input.salonId);
    return categorias.map(CategoriaServicioDTO.fromEntity);
  }
}
