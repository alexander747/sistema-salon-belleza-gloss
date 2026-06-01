import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { IUsuarioRepository } from '../../../domain/ports/IUsuarioRepository';
import type { IBcryptService } from '../../../../../modules/auth/infrastructure/services/BcryptService';
import { EmpleadaDTO } from '../../dtos/EmpleadaDTO';
import { ConflictError } from '../../../../../shared/errors';

interface CreateEmpleadaInput {
  salonId: number;
  nombre: string;
  numeroWhatsApp: string;
  email: string;
  password: string;
  rol: Rol;
  avatar?: string;
  fechaNacimiento?: string;
  porcentajeComisionServicio?: number;
  sueldoFijo?: number;
  bonoHorario?: number;
  frecuenciaBono?: string;
  userRol: Rol;
}

@injectable()
export class CreateEmpleadaUseCase {
  constructor(
    @inject('IPersonasUsuarioRepository') private readonly usuarioRepo: IUsuarioRepository,
    @inject('IBcryptService') private readonly bcryptService: IBcryptService,
  ) {}

  async execute(input: CreateEmpleadaInput): Promise<EmpleadaDTO> {
    // Check duplicate phone within the same salon
    const existingByPhone = await this.usuarioRepo.findBySalonAndPhone(
      input.salonId,
      input.numeroWhatsApp,
    );
    if (existingByPhone) {
      throw new ConflictError('Ya existe una empleada con este número de WhatsApp en el salón');
    }

    const hashedPassword = await this.bcryptService.hashPassword(input.password);

    const empleada = await this.usuarioRepo.create({
      salonId: input.salonId,
      nombre: input.nombre,
      numeroWhatsApp: input.numeroWhatsApp,
      email: input.email,
      passwordHash: hashedPassword,
      rol: input.rol,
      avatar: input.avatar ?? undefined,
      fechaNacimiento: input.fechaNacimiento ? new Date(input.fechaNacimiento) : undefined,
      porcentajeComisionServicio: input.porcentajeComisionServicio ?? 0,
      sueldoFijo: input.sueldoFijo ?? 0,
      bonoHorario: input.bonoHorario ?? 0,
      frecuenciaBono: input.frecuenciaBono ?? undefined,
      activo: true,
    });

    return EmpleadaDTO.fromEntity(empleada, input.userRol);
  }
}
