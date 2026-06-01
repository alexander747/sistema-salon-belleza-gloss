import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { ClienteDTO } from '../../dtos/ClienteDTO';

interface ListClientesInput {
  salonId: number;
  telefono?: string;
}

@injectable()
export class ListClientesUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: ListClientesInput): Promise<ClienteDTO[]> {
    const clientes = await this.clienteRepo.findBySalon(
      input.salonId,
      input.telefono,
    );

    return clientes.map((cli) => ClienteDTO.fromEntity(cli));
  }
}
