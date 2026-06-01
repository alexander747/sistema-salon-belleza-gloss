import type { QueryRunner } from 'typeorm';
import type { PagoTransaccionEntity } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';

export interface IPagoTransaccionRepository {
  create(data: Partial<PagoTransaccionEntity>, queryRunner?: QueryRunner): Promise<PagoTransaccionEntity>;
  findByRegistro(registroServicioId: number): Promise<PagoTransaccionEntity[]>;
  bulkCreate(data: Partial<PagoTransaccionEntity>[], queryRunner?: QueryRunner): Promise<PagoTransaccionEntity[]>;
}
