import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { PagoTransaccionEntity } from '../../../../infrastructure/persistence/entities/PagoTransaccionEntity';
import type { IPagoTransaccionRepository } from '../../domain/ports/IPagoTransaccionRepository';

@injectable()
export class TypeORMPagoTransaccionRepository implements IPagoTransaccionRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(PagoTransaccionEntity);
    }
    return AppDataSource.getRepository(PagoTransaccionEntity);
  }

  async create(data: Partial<PagoTransaccionEntity>, queryRunner?: QueryRunner): Promise<PagoTransaccionEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findByRegistro(registroServicioId: number): Promise<PagoTransaccionEntity[]> {
    return this.getRepo().find({
      where: { registroServicioId },
    });
  }

  async bulkCreate(data: Partial<PagoTransaccionEntity>[], queryRunner?: QueryRunner): Promise<PagoTransaccionEntity[]> {
    const repo = this.getRepo(queryRunner);
    const entities = repo.create(data);
    return repo.save(entities);
  }
}
