import { injectable } from 'tsyringe';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../../../../shared/database';
import { DivisionRegistroEntity } from '../../../../infrastructure/persistence/entities/DivisionRegistroEntity';
import type { IDivisionRegistroRepository } from '../../domain/ports/IDivisionRegistroRepository';

@injectable()
export class TypeORMDivisionRegistroRepository implements IDivisionRegistroRepository {
  private getRepo(queryRunner?: QueryRunner) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(DivisionRegistroEntity);
    }
    return AppDataSource.getRepository(DivisionRegistroEntity);
  }

  async create(data: Partial<DivisionRegistroEntity>, queryRunner?: QueryRunner): Promise<DivisionRegistroEntity> {
    const repo = this.getRepo(queryRunner);
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async findByRegistro(registroServicioId: number): Promise<DivisionRegistroEntity[]> {
    return this.getRepo().find({
      where: { registroServicioId },
    });
  }
}
