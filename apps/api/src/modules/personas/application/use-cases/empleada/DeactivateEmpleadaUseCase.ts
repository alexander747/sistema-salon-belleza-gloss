import { injectable, inject } from 'tsyringe';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import { NotFoundError, UnprocessableEntityError } from '../../../../../shared/errors';

interface DeactivateEmpleadaInput {
  salonId: number;
  id: number;
  requestingUserId: number;
}

@injectable()
export class DeactivateEmpleadaUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: DeactivateEmpleadaInput): Promise<{ activo: boolean }> {
    // GUARD: cannot deactivate self
    if (input.id === input.requestingUserId) {
      throw new UnprocessableEntityError('No puedes desactivar tu propia cuenta');
    }

    const empleada = await this.usuarioRepo.findBySalonAndId(input.salonId, input.id);
    if (!empleada) {
      throw new NotFoundError('Empleada no encontrada');
    }

    await this.usuarioRepo.updateActivo(input.id, false);
    return { activo: false };
  }
}
