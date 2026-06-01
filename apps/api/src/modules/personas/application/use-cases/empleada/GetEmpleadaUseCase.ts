import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import { EmpleadaDTO } from '../../dtos/EmpleadaDTO';
import { NotFoundError } from '../../../../../shared/errors';

interface GetEmpleadaInput {
  salonId: number;
  id: number;
  userRol: Rol;
}

@injectable()
export class GetEmpleadaUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: GetEmpleadaInput): Promise<EmpleadaDTO> {
    const empleada = await this.usuarioRepo.findBySalonAndId(input.salonId, input.id);
    if (!empleada) {
      throw new NotFoundError('Empleada no encontrada');
    }

    return EmpleadaDTO.fromEntity(empleada, input.userRol);
  }
}
