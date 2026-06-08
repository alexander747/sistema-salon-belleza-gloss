import type { PagoPrestamoEntity } from '../../../../infrastructure/persistence/entities/PagoPrestamoEntity';

export interface IPagoPrestamoRepository {
  findByPrestamo(prestamoId: number): Promise<PagoPrestamoEntity[]>;
  create(data: Partial<PagoPrestamoEntity>): Promise<PagoPrestamoEntity>;
}
