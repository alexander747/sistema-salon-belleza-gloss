import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface ActivateClienteInput {
  salonId: number;
  id: number;
}

@injectable()
export class ActivateClienteUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: ActivateClienteInput): Promise<{ activo: boolean }> {
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.id);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    await this.clienteRepo.update(input.id, { activo: true });
    return { activo: true };
  }
}
