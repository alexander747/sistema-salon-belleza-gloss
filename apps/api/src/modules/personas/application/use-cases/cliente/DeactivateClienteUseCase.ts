import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface DeactivateClienteInput {
  salonId: number;
  id: number;
}

/**
 * Soft-delete de cliente: los clientes con historial NO se eliminan, se
 * desactivan (activo=false). Conserva citas, registros y recompensas.
 */
@injectable()
export class DeactivateClienteUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: DeactivateClienteInput): Promise<{ activo: boolean }> {
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.id);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    await this.clienteRepo.update(input.id, { activo: false });
    return { activo: false };
  }
}
