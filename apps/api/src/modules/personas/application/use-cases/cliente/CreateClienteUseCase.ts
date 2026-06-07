import { injectable, inject } from 'tsyringe';
import type { IClienteRepository } from '../../../domain/ports/IClienteRepository';
import { ClienteDTO } from '../../dtos/ClienteDTO';
import { ConflictError } from '../../../../../shared/errors';

interface CreateClienteInput {
  salonId: number;
  nombre: string;
  telefono: string;
  cedula?: string;
  email?: string;
  fechaNacimiento?: string;
}

@injectable()
export class CreateClienteUseCase {
  constructor(
    @inject('IClienteRepository') private readonly clienteRepo: IClienteRepository,
  ) {}

  async execute(input: CreateClienteInput): Promise<{ cliente: ClienteDTO; created: boolean }> {
    // Idempotent: if telefono exists in salon, return existing
    const existing = await this.clienteRepo.findBySalonAndTelefono(
      input.salonId,
      input.telefono,
    );
    if (existing) {
      return { cliente: ClienteDTO.fromEntity(existing), created: false };
    }

    // Check cedula uniqueness in salon
    if (input.cedula) {
      const existingByCedula = await this.clienteRepo.findBySalonAndCedula(
        input.salonId,
        input.cedula,
      );
      if (existingByCedula) {
        throw new ConflictError('Ya existe un cliente con esta cédula en el salón');
      }
    }

    const cliente = await this.clienteRepo.create({
      salonId: input.salonId,
      nombre: input.nombre,
      telefono: input.telefono,
      cedula: input.cedula ?? null,
      email: input.email ?? undefined,
      fechaNacimiento: input.fechaNacimiento ? new Date(input.fechaNacimiento) : undefined,
      activo: true,
      puntajeConfianza: 100,
    });

    return { cliente: ClienteDTO.fromEntity(cliente), created: true };
  }
}
