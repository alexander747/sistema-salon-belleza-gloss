import { injectable, inject } from 'tsyringe';
import type { IRegistroServicioRepository } from '../../../domain/ports/IRegistroServicioRepository';
import type { RegistroServicioDTO } from '../../dtos/RegistroServicioDTO';
import { registroServicioToDTO } from '../../dtos/RegistroServicioDTO';
import { NotFoundError } from '../../../../../shared/errors';

export interface GetRegistroInput {
  id: number;
}

@injectable()
export class GetRegistroUseCase {
  constructor(
    @inject('IRegistroServicioRepository')
    private readonly registroRepo: IRegistroServicioRepository,
  ) {}

  async execute(input: GetRegistroInput): Promise<RegistroServicioDTO> {
    const registro = await this.registroRepo.findById(input.id);
    if (!registro) {
      throw new NotFoundError('Registro no encontrado');
    }

    return registroServicioToDTO(registro);
  }
}
