import { injectable } from 'tsyringe';
import { AppDataSource } from '../../../../shared/database';
import { UsuarioEntity } from '../../../../infrastructure/persistence/entities/UsuarioEntity';
import type { IUsuarioRepository } from '../../domain/ports/IUsuarioRepository';

@injectable()
export class TypeORMUsuarioRepository implements IUsuarioRepository {
  private getRepo() {
    return AppDataSource.getRepository(UsuarioEntity);
  }

  async findById(id: number): Promise<UsuarioEntity | null> {
    return this.getRepo().findOne({ where: { id }, relations: ['salon'] });
  }

  async findByEmail(email: string): Promise<UsuarioEntity | null> {
    return this.getRepo().findOne({ where: { email }, relations: ['salon'] });
  }

  async findByPhone(phone: string): Promise<UsuarioEntity | null> {
    return this.getRepo().findOneBy({ numeroWhatsApp: phone });
  }

  async create(data: Partial<UsuarioEntity>): Promise<UsuarioEntity> {
    const entity = this.getRepo().create(data);
    return this.getRepo().save(entity);
  }

  async update(id: number, data: Partial<UsuarioEntity>): Promise<UsuarioEntity | null> {
    await this.getRepo().update(id, data);
    return this.findById(id);
  }
}
