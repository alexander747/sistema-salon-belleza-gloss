import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import { AppDataSource } from '../../../../shared/database';
import { SalonEntity } from '../../../../infrastructure/persistence/entities/SalonEntity';
import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import { HorarioComercialEntity } from '../../../../infrastructure/persistence/entities/HorarioComercialEntity';
import { ConflictError } from '../../../../shared/errors';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';
import type { CreateSalonInput, SalonOutput } from '../dto/SalonDto';

const DEFAULT_HORARIOS = [
  { diaSemana: 1, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
  { diaSemana: 2, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
  { diaSemana: 3, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
  { diaSemana: 4, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
  { diaSemana: 5, horaApertura: '09:00', horaCierre: '18:00', estaAbierto: true },
  { diaSemana: 6, horaApertura: '10:00', horaCierre: '15:00', estaAbierto: true },
  { diaSemana: 0, horaApertura: null, horaCierre: null, estaAbierto: false },
];

@injectable()
export class CreateSalonUseCase {
  constructor(
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(
    input: CreateSalonInput,
    dueñaNombre: string,
    dueñaEmail: string,
    dueñaPassword: string,
    dueñaWhatsApp: string,
  ): Promise<SalonOutput> {
    // Generate unique API key
    const apiKeyN8n = crypto.randomBytes(32).toString('hex');

    // Create salon
    const salon = await this.salonRepo.create({
      nombre: input.nombre,
      numeroWhatsApp: input.numeroWhatsApp,
      nombreBot: input.nombreBot ?? 'Asistente Virtual',
      tonoVoz: input.tonoVoz ?? 'amigable',
      apiKeyN8n,
      logoUrl: input.logoUrl ?? undefined,
      colorPrimario: input.colorPrimario ?? undefined,
      colorSecundario: input.colorSecundario ?? undefined,
      tema: input.tema ?? undefined,
      horasCancelacion: input.horasCancelacion ?? 24,
    } as Partial<SalonEntity>);

    // Create default horarios
    const horarioRepo = AppDataSource.getRepository(HorarioComercialEntity);
    const horarios = DEFAULT_HORARIOS.map((h) =>
      horarioRepo.create({
        diaSemana: h.diaSemana,
        horaApertura: h.horaApertura ?? undefined,
        horaCierre: h.horaCierre ?? undefined,
        estaAbierto: h.estaAbierto,
        salonId: salon.id,
      }),
    );
    await horarioRepo.save(horarios);

    // Create dueña user for the salon
    const usuarioRepo = AppDataSource.getRepository(UsuarioEntity);
    const existingUser = await usuarioRepo.findOneBy({ email: dueñaEmail });
    if (existingUser) {
      throw new ConflictError(`Ya existe un usuario con el email ${dueñaEmail}`);
    }

    const passwordHash = await bcrypt.hash(dueñaPassword, 12);
    await usuarioRepo.save({
      nombre: dueñaNombre,
      email: dueñaEmail,
      passwordHash,
      rol: Rol.DUEÑA,
      salonId: salon.id,
      numeroWhatsApp: dueñaWhatsApp,
      activo: true,
    });

    return this.toOutput(salon);
  }

  private toOutput(entity: SalonEntity): SalonOutput {
    return {
      id: entity.id,
      nombre: entity.nombre,
      numeroWhatsApp: entity.numeroWhatsApp,
      nombreBot: entity.nombreBot,
      tonoVoz: entity.tonoVoz,
      plan: entity.plan,
      estado: entity.estado,
      activo: entity.activo,
      apiKeyN8n: entity.apiKeyN8n,
      logoUrl: entity.logoUrl ?? null,
      colorPrimario: entity.colorPrimario ?? null,
      colorSecundario: entity.colorSecundario ?? null,
      tema: entity.tema ?? null,
      horasCancelacion: entity.horasCancelacion,
      creadoEn: entity.creadoEn,
      ownerEmail: entity.usuarios?.find((u) => u.rol === Rol.DUEÑA)?.email ?? null,
    };
  }
}
