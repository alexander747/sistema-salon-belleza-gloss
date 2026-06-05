import bcrypt from 'bcrypt';
import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import { AppDataSource } from '../../../../shared/database';
import { NotFoundError } from '../../../../shared/errors';
import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';
import type { SalonOutput } from '../dto/SalonDto';
import type { SalonEntity } from '../../../../infrastructure/persistence/entities/SalonEntity';

export interface UpdateSalonInput {
  nombre?: string;
  numeroWhatsApp?: string;
  nombreBot?: string;
  tonoVoz?: string;
  plan?: string;
  estado?: string;
  activo?: boolean;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  tema?: string | null;
  horasCancelacion?: number;
  ownerPassword?: string;
  ownerNombre?: string;
  ownerEmail?: string;
  ownerWhatsApp?: string;
}

@injectable()
export class UpdateSalonUseCase {
  constructor(
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(id: number, data: UpdateSalonInput): Promise<SalonOutput> {
    const existing = await this.salonRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Salón con id ${id} no encontrado`);
    }

    // If password provided, update the DUEÑA user's password
    const usuarioRepo = AppDataSource.getRepository(UsuarioEntity);
    const duena = await usuarioRepo.findOneBy({ salonId: id, rol: Rol.DUEÑA });
    if (duena) {
      if (data.ownerPassword) {
        duena.passwordHash = await bcrypt.hash(data.ownerPassword, 12);
      }
      if (data.ownerNombre) {
        duena.nombre = data.ownerNombre;
      }
      if (data.ownerEmail) {
        duena.email = data.ownerEmail;
      }
      if (data.ownerWhatsApp) {
        duena.numeroWhatsApp = data.ownerWhatsApp;
      }
      await usuarioRepo.save(duena);
    }

    // Remove owner fields from salon update data
    const { ownerPassword: _, ownerNombre: __, ownerEmail: ___, ownerWhatsApp: ____, ...salonData } = data;
    const updated = await this.salonRepo.update(id, salonData as Partial<SalonEntity>);
    if (!updated) {
      throw new NotFoundError(`Salón con id ${id} no encontrado después de actualizar`);
    }

    const duena2 = updated.usuarios?.find((u) => u.rol === Rol.DUEÑA);
    return {
      id: updated.id,
      nombre: updated.nombre,
      numeroWhatsApp: updated.numeroWhatsApp,
      nombreBot: updated.nombreBot,
      tonoVoz: updated.tonoVoz,
      plan: updated.plan,
      estado: updated.estado,
      activo: updated.activo,
      apiKeyN8n: updated.apiKeyN8n,
      logoUrl: updated.logoUrl ?? null,
      colorPrimario: updated.colorPrimario ?? null,
      colorSecundario: updated.colorSecundario ?? null,
      tema: updated.tema ?? null,
      horasCancelacion: updated.horasCancelacion,
      creadoEn: updated.creadoEn,
      ownerEmail: duena2?.email ?? null,
      ownerNombre: duena2?.nombre ?? null,
      ownerWhatsApp: duena2?.numeroWhatsApp ?? null,
    };
  }
}
