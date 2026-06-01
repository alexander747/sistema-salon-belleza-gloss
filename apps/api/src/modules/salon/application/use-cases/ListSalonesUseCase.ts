import { injectable, inject } from 'tsyringe';
import { Rol } from '@pos-final/types';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';
import type { SalonOutput } from '../dto/SalonDto';

@injectable()
export class ListSalonesUseCase {
  constructor(
    @inject('ISalonRepository') private readonly salonRepo: ISalonRepository,
  ) {}

  async execute(): Promise<SalonOutput[]> {
    const salones = await this.salonRepo.findAll();
    return salones.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      numeroWhatsApp: s.numeroWhatsApp,
      nombreBot: s.nombreBot,
      tonoVoz: s.tonoVoz,
      plan: s.plan,
      estado: s.estado,
      activo: s.activo,
      apiKeyN8n: s.apiKeyN8n,
      logoUrl: s.logoUrl ?? null,
      colorPrimario: s.colorPrimario ?? null,
      colorSecundario: s.colorSecundario ?? null,
      tema: s.tema ?? null,
      horasCancelacion: s.horasCancelacion,
      creadoEn: s.creadoEn,
      ownerEmail: s.usuarios?.find((u) => u.rol === Rol.DUEÑA)?.email ?? null,
    }));
  }
}
