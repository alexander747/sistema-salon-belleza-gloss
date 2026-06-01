import { injectable, inject } from 'tsyringe';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import { NotFoundError } from '../../../../../shared/errors';

interface ActivateEmpleadaInput {
  salonId: number;
  id: number;
}

@injectable()
export class ActivateEmpleadaUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: ActivateEmpleadaInput): Promise<{ activo: boolean }> {
    const empleada = await this.usuarioRepo.findBySalonAndId(input.salonId, input.id);
    if (!empleada) {
      throw new NotFoundError('Empleada no encontrada');
    }

    await this.usuarioRepo.updateActivo(input.id, true);
    return { activo: true };
  }
}
