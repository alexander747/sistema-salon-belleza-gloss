import type { DevolucionEntity } from '../../../../infrastructure/persistence/entities/DevolucionEntity';

export interface IDevolucionRepository {
  create(data: Partial<DevolucionEntity>): Promise<DevolucionEntity>;
  findBySalon(salonId: number): Promise<DevolucionEntity[]>;
  findByRegistro(registroServicioId: number): Promise<DevolucionEntity[]>;
  search(params: {
    salonId: number;
    registroServicioId?: number;
    skip?: number;
    take?: number;
  }): Promise<DevolucionEntity[]>;
  count(params: {
    salonId: number;
    registroServicioId?: number;
  }): Promise<number>;
}
