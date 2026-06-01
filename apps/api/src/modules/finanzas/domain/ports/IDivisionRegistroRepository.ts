import type { QueryRunner } from 'typeorm';
import type { DivisionRegistroEntity } from '../../../../infrastructure/persistence/entities/DivisionRegistroEntity';

export interface IDivisionRegistroRepository {
  create(data: Partial<DivisionRegistroEntity>, queryRunner?: QueryRunner): Promise<DivisionRegistroEntity>;
  findByRegistro(registroServicioId: number): Promise<DivisionRegistroEntity[]>;
}
