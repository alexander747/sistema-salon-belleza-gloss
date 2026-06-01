import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { ClienteDTO } from '../../dtos/ClienteDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface GetClienteInput {
  salonId: number;
  id: number;
}

@injectable()
export class GetClienteUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: GetClienteInput): Promise<ClienteDTO> {
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.id);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    return ClienteDTO.fromEntity(cliente);
  }
}
