import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { ClienteDTO } from '../../dtos/ClienteDTO';
import { NotFoundError, ConflictError } from '../../../../../shared/errors';

interface UpdateClienteInput {
  salonId: number;
  id: number;
  nombre?: string;
  telefono?: string;
  cedula?: string;
  email?: string;
  fechaNacimiento?: string;
}

@injectable()
export class UpdateClienteUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: UpdateClienteInput): Promise<ClienteDTO> {
    const cliente = await this.clienteRepo.findBySalonAndId(input.salonId, input.id);
    if (!cliente) {
      throw new NotFoundError('Cliente no encontrado');
    }

    // Check duplicate phone if changing
    if (input.telefono !== undefined && input.telefono !== cliente.telefono) {
      const existingByPhone = await this.clienteRepo.findBySalonAndTelefono(
        input.salonId,
        input.telefono,
      );
      if (existingByPhone && existingByPhone.id !== input.id) {
        throw new ConflictError('Ya existe otro cliente con este teléfono en el salón');
      }
    }

    // Check cedula uniqueness if changing
    if (input.cedula !== undefined && input.cedula !== cliente.cedula) {
      const existingByCedula = await this.clienteRepo.findBySalonAndCedula(
        input.salonId,
        input.cedula,
      );
      if (existingByCedula && existingByCedula.id !== input.id) {
        throw new ConflictError('Ya existe otro cliente con esta cédula en el salón');
      }
    }

    const data: Record<string, unknown> = {};
    if (input.nombre !== undefined) data.nombre = input.nombre;
    if (input.telefono !== undefined) data.telefono = input.telefono;
    if (input.cedula !== undefined) data.cedula = input.cedula || null;
    if (input.email !== undefined) data.email = input.email;
    if (input.fechaNacimiento !== undefined) data.fechaNacimiento = new Date(input.fechaNacimiento);

    const updated = await this.clienteRepo.update(input.id, data);

    return ClienteDTO.fromEntity(updated!);
  }
}
