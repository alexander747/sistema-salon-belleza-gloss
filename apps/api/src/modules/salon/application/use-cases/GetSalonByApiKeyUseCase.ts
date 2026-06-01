import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import { NotFoundError } from '../../../../shared/errors';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';
import type { SalonOutput } from '../dto/SalonDto';

@injectable()
export class GetSalonByApiKeyUseCase {
  constructor(
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(salonId: number): Promise<SalonOutput> {
    const salon = await this.salonRepo.findById(salonId);
    if (!salon) {
      throw new NotFoundError('Salón no encontrado');
    }
    return {
      id: salon.id,
      nombre: salon.nombre,
      numeroWhatsApp: salon.numeroWhatsApp,
      nombreBot: salon.nombreBot,
      tonoVoz: salon.tonoVoz,
      plan: salon.plan,
      estado: salon.estado,
      activo: salon.activo,
      apiKeyN8n: salon.apiKeyN8n,
      logoUrl: salon.logoUrl ?? null,
      colorPrimario: salon.colorPrimario ?? null,
      colorSecundario: salon.colorSecundario ?? null,
      tema: salon.tema ?? null,
      horasCancelacion: salon.horasCancelacion,
      creadoEn: salon.creadoEn,
      ownerEmail: salon.usuarios?.find((u) => u.rol === Rol.DUEÑA)?.email ?? null,
    };
  }
}
