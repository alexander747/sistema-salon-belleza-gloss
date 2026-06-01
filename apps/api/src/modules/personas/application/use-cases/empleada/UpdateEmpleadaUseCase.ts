import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import type { IBcryptService } from '../../../../../modules/auth/infrastructure/services/BcryptService';
import { EmpleadaDTO } from '../../dtos/EmpleadaDTO';
import { NotFoundError, ConflictError } from '../../../../../shared/errors';

interface UpdateEmpleadaInput {
  salonId: number;
  id: number;
  nombre?: string;
  numeroWhatsApp?: string;
  email?: string;
  password?: string;
  rol?: Rol;
  avatar?: string;
  fechaNacimiento?: string;
  porcentajeComisionServicio?: number;
  sueldoFijo?: number;
  bonoHorario?: number;
  frecuenciaBono?: string;
  userRol: Rol;
}

@injectable()
export class UpdateEmpleadaUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject('IBcryptService') private readonly bcryptService: IBcryptService,
  ) {}

  async execute(input: UpdateEmpleadaInput): Promise<EmpleadaDTO> {
    const empleada = await this.usuarioRepo.findBySalonAndId(input.salonId, input.id);
    if (!empleada) {
      throw new NotFoundError('Empleada no encontrada');
    }

    // Check duplicate phone if changing
    if (input.numeroWhatsApp !== undefined && input.numeroWhatsApp !== empleada.numeroWhatsApp) {
      const existingByPhone = await this.usuarioRepo.findBySalonAndPhone(
        input.salonId,
        input.numeroWhatsApp,
      );
      if (existingByPhone && existingByPhone.id !== input.id) {
        throw new ConflictError('Ya existe otra empleada con este número de WhatsApp en el salón');
      }
    }

    const data: Record<string, unknown> = {};
    if (input.nombre !== undefined) data.nombre = input.nombre;
    if (input.numeroWhatsApp !== undefined) data.numeroWhatsApp = input.numeroWhatsApp;
    if (input.email !== undefined) data.email = input.email;
    if (input.rol !== undefined) data.rol = input.rol;
    if (input.avatar !== undefined) data.avatar = input.avatar;
    if (input.fechaNacimiento !== undefined) data.fechaNacimiento = new Date(input.fechaNacimiento);
    if (input.porcentajeComisionServicio !== undefined) data.porcentajeComisionServicio = input.porcentajeComisionServicio;
    if (input.sueldoFijo !== undefined) data.sueldoFijo = input.sueldoFijo;
    if (input.bonoHorario !== undefined) data.bonoHorario = input.bonoHorario;
    if (input.frecuenciaBono !== undefined) data.frecuenciaBono = input.frecuenciaBono;

    // Hash password only if provided
    if (input.password !== undefined) {
      data.passwordHash = await this.bcryptService.hashPassword(input.password);
    }

    const updated = await this.usuarioRepo.update(input.id, data);

    return EmpleadaDTO.fromEntity(updated!, input.userRol);
  }
}
