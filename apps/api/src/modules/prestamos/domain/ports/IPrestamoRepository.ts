import type { PrestamoEntity } from '../../../../infrastructure/persistence/entities/PrestamoEntity';

export interface PrestamoSearchParams {
  salonId: number;
  estado?: string;
  usuarioId?: number;
  page?: number;
  limit?: number;
}

export interface IPrestamoRepository {
  findById(id: number): Promise<PrestamoEntity | null>;
  findBySalon(params: PrestamoSearchParams): Promise<[PrestamoEntity[], number]>;
  findByUsuario(salonId: number, usuarioId: number): Promise<PrestamoEntity[]>;
  findActivosByUsuario(salonId: number, usuarioId: number): Promise<PrestamoEntity[]>;
  create(data: Partial<PrestamoEntity>): Promise<PrestamoEntity>;
  update(id: number, data: Partial<PrestamoEntity>): Promise<PrestamoEntity | null>;
}
