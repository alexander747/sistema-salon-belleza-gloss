import { injectable, inject } from 'tsyringe';
import type { IPrestamoRepository } from '../../domain/ports/IPrestamoRepository';
import type { PrestamoDTO } from '../dtos/PrestamoDTO';
import { paginate, type PaginatedResult } from '../../../../shared/pagination';

export interface ListarPrestamosInput {
  salonId: number;
  estado?: string;
  usuarioId?: number;
  page?: number;
  limit?: number;
}

@injectable()
export class ListarPrestamosUseCase {
  constructor(
    @inject('IPrestamoRepository')
    private readonly prestamoRepo: IPrestamoRepository,
  ) {}

  async execute(input: ListarPrestamosInput): Promise<PaginatedResult<PrestamoDTO>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 0;

    const [prestamos, total] = await this.prestamoRepo.findBySalon({
      salonId: input.salonId,
      estado: input.estado,
      usuarioId: input.usuarioId,
      page,
      limit,
    });

    const data = prestamos.map((p) => ({
      id: p.id,
      salonId: p.salonId,
      usuarioId: p.usuarioId,
      nombreEmpleado: p.usuario?.nombre ?? null,
      nombreTercero: p.nombreTercero,
      monto: Number(p.monto),
      saldoPendiente: Number(p.saldoPendiente),
      motivo: p.motivo,
      estado: p.estado,
      fechaCreacion: p.fechaCreacion?.toISOString?.() ?? String(p.fechaCreacion),
      creadoEn: p.creadoEn?.toISOString?.() ?? String(p.creadoEn),
      actualizadoEn: p.actualizadoEn?.toISOString?.() ?? String(p.actualizadoEn),
    }));

    return paginate(data, total, { page, limit });
  }
}
