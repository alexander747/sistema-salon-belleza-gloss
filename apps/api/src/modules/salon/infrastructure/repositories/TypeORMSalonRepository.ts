import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { SalonEntity } from '../../../../infrastructure/persistence/entities/SalonEntity';
import type { ISalonRepository } from '../../domain/ports/ISalonRepository';

@injectable()
export class TypeORMSalonRepository implements ISalonRepository {
  private getRepo() {
    return AppDataSource.getRepository(SalonEntity);
  }

  async findById(id: number): Promise<SalonEntity | null> {
    return this.getRepo().findOne({ where: { id }, relations: ['usuarios'] });
  }

  async findAll(): Promise<SalonEntity[]> {
    return this.getRepo().find({ order: { creadoEn: 'DESC' }, relations: ['usuarios'] });
  }

  async create(salon: Partial<SalonEntity>): Promise<SalonEntity> {
    const entity = this.getRepo().create(salon);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<SalonEntity>): Promise<SalonEntity | null> {
    await this.getRepo().update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.getRepo().delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findByApiKey(apiKey: string): Promise<SalonEntity | null> {
    return this.getRepo().findOneBy({ apiKeyN8n: apiKey });
  }
}
