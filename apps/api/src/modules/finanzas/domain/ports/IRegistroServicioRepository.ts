import type { QueryRunner } from 'typeorm';
import type { RegistroServicioEntity } from '../../../../infrastructure/persistence/entities/RegistroServicioEntity';

export interface IRegistroServicioRepository {
  create(data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity>;
  findById(id: number): Promise<RegistroServicioEntity | null>;
  findBySalon(salonId: number): Promise<RegistroServicioEntity[]>;
  findBySalonAndDateRange(salonId: number, fechaInicio: Date, fechaFin: Date): Promise<RegistroServicioEntity[]>;
  search(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
    skip?: number;
    take?: number;
  }): Promise<RegistroServicioEntity[]>;
  count(params: {
    salonId: number;
    desde?: Date;
    hasta?: Date;
    usuarioId?: number;
    clienteId?: number;
  }): Promise<number>;
  update(id: number, data: Partial<RegistroServicioEntity>, queryRunner?: QueryRunner): Promise<RegistroServicioEntity | null>;
}
