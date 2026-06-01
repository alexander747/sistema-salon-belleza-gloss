import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import { EmpleadaDTO } from '../../dtos/EmpleadaDTO';

interface ListEmpleadasInput {
  salonId: number;
  userRol: Rol;
  rol?: Rol;
  activo?: boolean;
}

@injectable()
export class ListEmpleadasUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
  ) {}

  async execute(input: ListEmpleadasInput): Promise<EmpleadaDTO[]> {
    const empleadas = await this.usuarioRepo.findBySalon(
      input.salonId,
      input.rol,
      input.activo,
    );

    return empleadas.map((emp) => EmpleadaDTO.fromEntity(emp, input.userRol));
  }
}
