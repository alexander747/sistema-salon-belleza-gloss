import { SalonEntity } from '../../../../infrastructure/persistence/entities/SalonEntity';

export interface ISalonRepository {
  findById(id: number): Promise<SalonEntity | null>;
  findAll(): Promise<SalonEntity[]>;
  create(salon: Partial<SalonEntity>): Promise<SalonEntity>;
  update(id: number, data: Partial<SalonEntity>): Promise<SalonEntity | null>;
  delete(id: number): Promise<boolean>;
  findByApiKey(apiKey: string): Promise<SalonEntity | null>;
}
