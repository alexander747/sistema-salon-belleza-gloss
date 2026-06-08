import type { GastoEntity } from '../../../../infrastructure/persistence/entities/GastoEntity';

export interface IGastoRepository {
  findById(id: number): Promise<GastoEntity | null>;
  findBySalon(salonId: number): Promise<GastoEntity[]>;
  search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    esGastoFijo?: boolean;
    skip?: number;
    take?: number;
  }): Promise<GastoEntity[]>;
  count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    esGastoFijo?: boolean;
  }): Promise<number>;
  sumBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<number>;
  create(data: Partial<GastoEntity>): Promise<GastoEntity>;
  delete(id: number): Promise<void>;
}
